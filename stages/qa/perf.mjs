// QA · Performance and Lighthouse. Mobile (throttled) and desktop runs on the production build,
// scored against the studio's category thresholds, Core Web Vitals budgets and a page-weight budget.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
import { serve } from '../lib/serve.mjs';
import { distDir, reportDir, result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

export async function perfGate(slug) {
  const cfg = await loadConfig(slug);
  const lh = cfg.lighthouse;
  const server = await serve(distDir(slug));
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });
  const dir = join(reportDir(slug), 'lighthouse');
  await mkdir(dir, { recursive: true });
  const findings = [];
  const scores = {};

  try {
    for (const path of cfg.pages) {
      const url = new URL(path.replace(/^\//, ''), server.url).href;
      for (const formFactor of ['mobile', 'desktop']) {
        const where = `${path} ${formFactor}`;
        const runnerResult = await lighthouse(
          url,
          { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
          formFactor === 'desktop' ? desktopConfig : undefined,
        );
        const { lhr, report } = runnerResult;
        const name = `${path === '/' ? 'home' : path.replace(/\W+/g, '-')}-${formFactor}`;
        await writeFile(join(dir, `${name}.html`), report[0]);

        const s = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
        scores[where] = s;
        for (const [cat, min] of Object.entries(lh[formFactor])) {
          const score = lhr.categories[cat]?.score ?? 0;
          if (score < min) {
            // Name the audits that cost the points so the fix is obvious.
            const lost = lhr.categories[cat].auditRefs
              .filter((r) => r.weight > 0 && lhr.audits[r.id].score !== null && lhr.audits[r.id].score < 0.9)
              .map((r) => lhr.audits[r.id].title)
              .slice(0, 4);
            findings.push({ level: 'fail', where, message: `${cat} ${Math.round(score * 100)} < ${min * 100}${lost.length ? `: ${lost.join('; ')}` : ''}` });
          }
        }
        if (formFactor === 'mobile') {
          for (const [metric, budget] of Object.entries(lh.metrics)) {
            const v = lhr.audits[metric]?.numericValue;
            if (v != null && v > budget) findings.push({ level: 'fail', where, message: `${metric} ${Math.round(v * 1000) / 1000} over budget ${budget}` });
          }
          const kb = Math.round(lhr.audits['total-byte-weight'].numericValue / 1024);
          scores[where].weightKb = kb;
          scores[where].lcpMs = Math.round(lhr.audits['largest-contentful-paint'].numericValue);
          scores[where].cls = Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3));
          if (kb > lh.pageWeightKb) findings.push({ level: 'fail', where, message: `Page weight ${kb} KB over budget ${lh.pageWeightKb} KB` });
        }
      }
    }
  } finally {
    await chrome.kill();
    await server.close();
  }
  return result('perf', applyWaivers('perf', findings, cfg.waivers), { scores });
}
