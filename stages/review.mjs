// Stage 6 · Review. Turns results.json, the screenshots and approvals.yaml into one page the studio
// lead and the client read before anyone signs: what passed, what was waived and why, how it looks
// at every width and in every engine, and who has signed what.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectDir, reportDir, readYaml, log } from './lib/util.mjs';
import { buildHash } from './qa/index.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LABEL = { pass: 'Passed', warn: 'Passed with notes', fail: 'Failed', skip: 'Skipped' };

export async function review(slug) {
  const results = JSON.parse(await readFile(join(reportDir(slug), 'results.json'), 'utf8'));
  const brief = await readYaml(join(projectDir(slug), 'brief.yaml'));
  const approvals = (await readYaml(join(projectDir(slug), 'approvals.yaml')).catch(() => ({}))) ?? {};
  const current = await buildHash(slug);
  const stale = current !== results.build;
  const g = Object.fromEntries(results.gates.map((r) => [r.name, r]));

  const verdict = stale
    ? 'The build changed after QA ran. Run the checks again before review.'
    : results.passed
      ? 'Every gate passed. Ready for sign-off.'
      : 'Some gates failed. Fix them and run the checks again.';

  const gateRows = results.gates
    .map(
      (r) => `<tr class="is-${r.status}">
        <th scope="row">${esc(r.title)}<span>${esc(r.stage)}</span></th>
        <td><span class="pill">${LABEL[r.status]}</span></td>
        <td>${r.findings.length ? `<ul>${r.findings.map((f) => `<li class="f-${f.level}">${f.where ? `<b>${esc(f.where)}</b> ` : ''}${esc(f.message)}</li>`).join('')}</ul>` : 'No findings.'}</td>
      </tr>`,
    )
    .join('');

  const scores = g.perf?.data?.scores ?? {};
  const scoreRows = Object.entries(scores)
    .map(
      ([where, s]) => `<tr><th scope="row">${esc(where)}</th>${['performance', 'accessibility', 'best-practices', 'seo']
        .map((k) => `<td class="${s[k] >= 90 ? 'good' : 'bad'}">${s[k] ?? '–'}</td>`)
        .join('')}<td>${s.weightKb ? `${s.weightKb} KB · LCP ${(s.lcpMs / 1000).toFixed(1)}s · CLS ${s.cls}` : ''}</td></tr>`,
    )
    .join('');

  const tokens = g.design?.data?.tokens ?? {};
  const ratios = g.design?.data?.ratios ?? {};
  const swatches = Object.entries(tokens)
    .map(([k, v]) => `<li><span style="background:${esc(v)}"></span><b>--${esc(k)}</b> ${esc(v)}</li>`)
    .join('');
  const ratioList = Object.entries(ratios).map(([k, v]) => `<li>${esc(k)} <b>${v}:1</b></li>`).join('');

  const shots = g.responsive?.data?.shots ?? [];
  const shotFigs = shots
    .map(
      (s) => `<figure class="shot shot--${s.width}"><a href="shots/${esc(s.full)}"><img src="shots/${esc(s.file)}" alt="${esc(s.page)} at ${s.width}px" loading="lazy"></a><figcaption>${s.width}px · <a href="shots/${esc(s.full)}">full page</a></figcaption></figure>`,
    )
    .join('');
  const engineShots = (g.browsers?.data?.shots ?? [])
    .map((s) => `<figure class="shot shot--${s.width}"><img src="shots/${esc(s.file)}" alt="${esc(s.engine)} at ${s.width}px" loading="lazy"><figcaption>${esc(s.engine)} · ${s.width}px</figcaption></figure>`)
    .join('');
  const engines = g.browsers?.data?.ran ?? [];

  const signRows = Object.entries(approvals)
    .map(
      ([stage, a]) => `<tr class="${a?.by ? 'signed' : 'open'}"><th scope="row">${esc(stage.replace(/_/g, ' '))}</th><td>${a?.by ? `${esc(a.by)}, ${esc(a.on)}` : 'Not signed'}</td><td>${esc(a?.note ?? '')}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brief.client.name)} · Review</title>
<style>
:root{--bg:#f4f3ee;--ink:#191a16;--soft:#5b5c55;--line:#dcdad1;--good:#1f6b3a;--warn:#8a5a00;--bad:#a8261c;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
::selection{background:var(--ink);color:var(--bg)}a{color:inherit;text-underline-offset:.2em}:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
main{max-width:1200px;margin:0 auto;padding:48px 24px 96px}
h1{font-size:clamp(2rem,1.4rem + 2.5vw,3.25rem);line-height:1.05;letter-spacing:-.03em;margin:0 0 12px;text-wrap:balance}
h2{font-size:1.5rem;letter-spacing:-.02em;margin:72px 0 16px}
.lede{font-size:1.25rem;max-width:60ch;margin:0}.meta{color:var(--soft);margin-top:12px;font-variant-numeric:tabular-nums}
.verdict{margin-top:32px;padding:20px 24px;background:var(--ink);color:var(--bg);font-size:1.125rem}
.verdict.is-fail{background:var(--bad)}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{text-align:left;vertical-align:top;padding:14px 12px;border-top:1px solid var(--line)}
th span{display:block;color:var(--soft);font-weight:400;font-size:.875rem}
.gates td ul{margin:0;padding-left:18px}.gates li{margin:2px 0}.f-fail{color:var(--bad)}.f-warn{color:var(--warn)}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.875rem;white-space:nowrap;background:#e4efe6;color:var(--good)}
.is-warn .pill{background:#f6ecd6;color:var(--warn)}.is-fail .pill{background:#f6dcd8;color:var(--bad)}
.scores td{font-size:1.25rem}.scores td:last-child{font-size:.9375rem;color:var(--soft)}.good{color:var(--good)}.bad{color:var(--bad)}
.swatches,.ratios{display:flex;flex-wrap:wrap;gap:16px 32px;list-style:none;padding:0}
.swatches span{display:block;width:120px;height:72px;margin-bottom:8px;border:1px solid var(--line)}
.shots{display:grid;grid-template-columns:1fr 2fr 4fr;gap:16px;align-items:start}
.shot{margin:0}.shot img{width:100%;height:auto;border:1px solid var(--line);display:block}.shot figcaption{color:var(--soft);font-size:.875rem;margin-top:6px}
.signed th{color:var(--good)}.open td:nth-child(2){color:var(--bad)}
@media (width < 760px){.shots{grid-template-columns:1fr 1fr}.shot--1440{grid-column:1/-1}.gates th{width:30%}}
</style>
</head>
<body>
<main>
  <h1>${esc(brief.client.name)}: review before sign-off</h1>
  <p class="lede">${esc(brief.client.kind)}. ${esc(brief.goal.success)}.</p>
  <p class="meta">QA ran ${esc(new Date(results.at).toUTCString())} on build <code>${esc(results.build)}</code>${stale ? ` (current build is <code>${esc(current)}</code>)` : ''}${results.partial ? ' · partial run' : ''}</p>
  <p class="verdict ${results.passed && !stale ? '' : 'is-fail'}">${verdict}</p>

  <h2>Gates</h2>
  <table class="gates"><thead><tr><th>Gate</th><th>Result</th><th>Findings</th></tr></thead><tbody>${gateRows}</tbody></table>

  ${scoreRows ? `<h2>Lighthouse</h2><table class="scores"><thead><tr><th>Run</th><th>Performance</th><th>Accessibility</th><th>Best practices</th><th>SEO</th><th>Mobile budget</th></tr></thead><tbody>${scoreRows}</tbody></table><p class="meta">Full reports: <a href="lighthouse/">lighthouse/</a></p>` : ''}

  ${swatches ? `<h2>Design tokens</h2><ul class="swatches">${swatches}</ul><ul class="ratios">${ratioList}</ul>` : ''}

  ${shotFigs ? `<h2>Responsive</h2><p class="meta">Tested at ${(g.responsive.data.viewports ?? []).join(', ')} px. Shown at phone, tablet and desktop; open any for the full page.</p><div class="shots">${shotFigs}</div>` : ''}

  ${engineShots ? `<h2>Browsers</h2><p class="meta">Engines run here: ${engines.join(', ') || 'none'}. CI runs Chromium, Firefox and WebKit.</p><div class="shots">${engineShots}</div>` : ''}

  <h2>Sign-off</h2>
  <table class="sign"><thead><tr><th>Stage</th><th>Approved by</th><th>Note</th></tr></thead><tbody>${signRows}</tbody></table>
</main>
</body>
</html>`;
  const out = join(reportDir(slug), 'report.html');
  await writeFile(out, html);
  log.ok('review', `report → ${out.replace(process.cwd() + '/', '')}`);
  return out;
}
