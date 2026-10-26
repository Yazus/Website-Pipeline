// The QA stage runs every gate in order and records the results against a hash of the build,
// so the review and deploy stages can prove QA ran on exactly what ships.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { briefGate } from '../brief.mjs';
import { contentGate } from '../content.mjs';
import { designGate } from '../design.mjs';
import { lintGate } from './lint.mjs';
import { a11yGate } from './a11y.mjs';
import { responsiveGate } from './responsive.mjs';
import { browsersGate } from './browsers.mjs';
import { seoGate } from './seo.mjs';
import { perfGate } from './perf.mjs';
import { tasteGate } from './taste.mjs';
import { distDir, reportDir, log } from '../lib/util.mjs';

export const GATES = {
  brief: { run: briefGate, title: 'Brief', stage: 'Discovery' },
  content: { run: contentGate, title: 'Content', stage: 'Content' },
  design: { run: designGate, title: 'Design system', stage: 'Design' },
  lint: { run: lintGate, title: 'Code lint', stage: 'QA' },
  a11y: { run: a11yGate, title: 'Accessibility', stage: 'QA' },
  responsive: { run: responsiveGate, title: 'Responsive', stage: 'QA' },
  browsers: { run: browsersGate, title: 'Cross-browser', stage: 'QA' },
  seo: { run: seoGate, title: 'SEO and links', stage: 'QA' },
  taste: { run: tasteGate, title: 'Taste inspector', stage: 'QA' },
  perf: { run: perfGate, title: 'Performance', stage: 'QA' },
};

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out.push(...(e.isDirectory() ? await walk(p) : [p]));
  }
  return out.sort();
}

export async function buildHash(slug) {
  const dir = distDir(slug);
  const h = createHash('sha256');
  for (const f of await walk(dir)) {
    h.update(relative(dir, f));
    h.update(await readFile(f));
  }
  return h.digest('hex').slice(0, 16);
}

export async function runQa(slug, only) {
  const names = only?.length ? only : Object.keys(GATES);
  const results = [];
  for (const name of names) {
    const gate = GATES[name];
    if (!gate) throw new Error(`Unknown gate "${name}". Gates: ${Object.keys(GATES).join(', ')}`);
    const t0 = Date.now();
    let res;
    try {
      res = await gate.run(slug);
    } catch (e) {
      res = { name, status: 'fail', findings: [{ level: 'fail', message: `Gate crashed: ${e.message}` }] };
    }
    res.title = gate.title;
    res.stage = gate.stage;
    res.ms = Date.now() - t0;
    results.push(res);
    const n = res.findings.length;
    const line = `${gate.title}: ${res.status}${n ? ` (${n} finding${n > 1 ? 's' : ''})` : ''} in ${(res.ms / 1000).toFixed(1)}s`;
    (res.status === 'fail' ? log.fail : res.status === 'warn' ? log.warn : log.ok)(name, line);
    for (const f of res.findings.filter((f) => f.level === 'fail')) console.log(`    ${f.where ? `[${f.where}] ` : ''}${f.message}`);
  }

  const record = {
    slug,
    at: new Date().toISOString(),
    build: await buildHash(slug),
    partial: Boolean(only?.length),
    passed: results.every((r) => r.status !== 'fail'),
    gates: results,
  };
  await mkdir(reportDir(slug), { recursive: true });
  await writeFile(join(reportDir(slug), 'results.json'), JSON.stringify(record, null, 2));
  return record;
}
