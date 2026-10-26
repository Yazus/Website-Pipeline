// QA · Cross-browser. Chromium, Firefox and WebKit (Safari's engine) at phone and desktop width:
// no script errors, no failed requests, fonts and images actually loaded, no sideways scroll, and the
// main landmarks laid out within a few percent of each other across engines.
// An engine that is not installed is reported as skipped; CI installs all three.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openSite, scrollThrough, newPage, isEngineAvailable } from '../lib/browser.mjs';
import { reportDir, result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

const LANDMARKS = ['h1', 'main', 'footer', 'nav'];

export async function browsersGate(slug) {
  const cfg = await loadConfig(slug);
  const shotsDir = join(reportDir(slug), 'shots');
  await mkdir(shotsDir, { recursive: true });
  const findings = [];
  const layouts = {};
  const ran = [];
  const shots = [];

  for (const engine of cfg.browsers) {
    if (!(await isEngineAvailable(engine))) {
      findings.push({ level: 'warn', where: engine, message: `${engine} is not installed on this machine; it runs in CI (npx playwright install --with-deps ${engine})` });
      continue;
    }
    ran.push(engine);
    const site = await openSite(slug, engine);
    try {
      for (const path of cfg.pages) {
        for (const width of [390, 1440]) {
          const page = await newPage(site.browser, { viewport: { width, height: width < 768 ? 844 : 900 } });
          const errors = [];
          page.on('pageerror', (e) => errors.push(`script error: ${e.message}`));
          page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
          page.on('requestfailed', (r) => !r.url().startsWith('mailto:') && errors.push(`request failed: ${r.url()}`));
          page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));
          await page.goto(new URL(path.replace(/^\//, ''), site.url).href, { waitUntil: 'networkidle' });
          await scrollThrough(page);
          await page.waitForTimeout(500);
          const where = `${engine} ${path} @${width}px`;

          const m = await page.evaluate((LANDMARKS) => {
            const fonts = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
            const brokenImages = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src);
            const box = Object.fromEntries(
              LANDMARKS.map((sel) => {
                const el = document.querySelector(sel);
                if (!el) return [sel, null];
                const r = el.getBoundingClientRect();
                return [sel, { w: r.width, h: r.height }];
              }),
            );
            return {
              fonts,
              brokenImages,
              box,
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              height: document.documentElement.scrollHeight,
            };
          }, LANDMARKS);

          for (const e of [...new Set(errors)]) findings.push({ level: 'fail', where, message: e });
          for (const f of m.fonts.filter((f) => f.endsWith('error'))) findings.push({ level: 'fail', where, message: `Font failed: ${f}` });
          for (const s of m.brokenImages) findings.push({ level: 'fail', where, message: `Image failed: ${s}` });
          if (m.overflow > 0) findings.push({ level: 'fail', where, message: `Sideways scroll of ${m.overflow}px` });
          layouts[`${path}@${width}`] ??= {};
          layouts[`${path}@${width}`][engine] = m;

          const file = `${engine}-${path === '/' ? 'home' : path.replace(/\W+/g, '-')}-${width}.png`;
          await page.screenshot({ path: join(shotsDir, file) });
          shots.push({ engine, page: path, width, file });
          await page.close();
        }
      }
    } finally {
      await site.close();
    }
  }

  // Compare engines against the first one that ran.
  for (const [key, byEngine] of Object.entries(layouts)) {
    const [base, ...others] = Object.keys(byEngine);
    for (const other of others) {
      for (const sel of LANDMARKS) {
        const a = byEngine[base].box[sel], b = byEngine[other].box[sel];
        if (!a || !b) continue;
        const dh = Math.abs(a.h - b.h) / Math.max(a.h, 1);
        if (dh > 0.05) findings.push({ level: 'warn', where: `${other} ${key}`, message: `${sel} is ${Math.round(dh * 100)}% taller or shorter than in ${base}` });
      }
      const dh = Math.abs(byEngine[base].height - byEngine[other].height) / byEngine[base].height;
      if (dh > 0.05) findings.push({ level: 'warn', where: `${other} ${key}`, message: `Page length differs from ${base} by ${Math.round(dh * 100)}%` });
    }
  }

  const res = result('browsers', applyWaivers('browsers', findings, cfg.waivers), { ran, shots });
  if (!ran.length) res.status = 'fail';
  return res;
}
