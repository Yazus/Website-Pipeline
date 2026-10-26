// Stage 7 · Deploy. Refuses to ship anything QA did not pass, or a build that changed since QA ran.
// A preview needs QA; production also needs every sign-off in approvals.yaml.
// The output is public/<slug>/ plus a studio index, ready for any static host (CI publishes it to
// GitHub Pages).
import { cp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, distDir, projectDir, reportDir, readYaml, log } from './lib/util.mjs';
import { buildHash } from './qa/index.mjs';

export async function deploy(slug, { production = false } = {}) {
  const problems = [];
  const results = JSON.parse(await readFile(join(reportDir(slug), 'results.json'), 'utf8').catch(() => 'null'));
  if (!results) problems.push('QA has not run for this project');
  else {
    if (results.partial) problems.push('The last QA run was partial; run every gate');
    if (!results.passed) problems.push(`QA failed: ${results.gates.filter((g) => g.status === 'fail').map((g) => g.title).join(', ')}`);
    if (results.build !== (await buildHash(slug))) problems.push('The build changed after QA ran');
  }
  if (production) {
    const approvals = (await readYaml(join(projectDir(slug), 'approvals.yaml')).catch(() => ({}))) ?? {};
    const missing = Object.entries(approvals).filter(([, a]) => !a?.by).map(([k]) => k.replace(/_/g, ' '));
    if (missing.length) problems.push(`Not signed off: ${missing.join(', ')}`);
    const brief = await readYaml(join(projectDir(slug), 'brief.yaml'));
    if (brief.client?.status === 'sample') problems.push('This is a sample project; it cannot go to production');
  }
  if (problems.length) {
    for (const p of problems) log.fail('deploy', p);
    throw new Error(`deploy refused for ${slug}`);
  }

  const pub = join(ROOT, 'public');
  await rm(join(pub, slug), { recursive: true, force: true });
  await mkdir(pub, { recursive: true });
  await cp(distDir(slug), join(pub, slug), { recursive: true });
  // The review report travels with the preview so the client can read it beside the site.
  if (!production) await cp(reportDir(slug), join(pub, slug, '_review'), { recursive: true });
  await writeIndex(pub);
  await writeFile(join(pub, slug, 'deploy.json'), JSON.stringify({ slug, build: results.build, at: new Date().toISOString(), production }, null, 2));
  log.ok('deploy', `${production ? 'production' : 'preview'} → public/${slug}/`);
}

async function writeIndex(pub) {
  const sites = (await readdir(pub, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const items = sites.map((s) => `<li><a href="${s}/">${s}</a> · <a href="${s}/_review/report.html">review</a></li>`).join('');
  await writeFile(
    join(pub, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Website Pipeline · previews</title><style>body{margin:0;padding:48px 24px;font:18px/1.5 system-ui,sans-serif;background:#f4f3ee;color:#191a16}main{max-width:720px;margin:auto}h1{letter-spacing:-.02em}a{color:inherit}li{margin:8px 0}</style></head><body><main><h1>Previews</h1><ul>${items}</ul></main></body></html>`,
  );
}
