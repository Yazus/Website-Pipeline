#!/usr/bin/env node
// The pipeline's command line. `npm run site -- <command> <project> [options]`
import { cp, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, projectDir, log } from '../stages/lib/util.mjs';

const HELP = `Website pipeline

  new <slug> "<Client name>"   Start a project from templates/project
  art <slug>                   Render art/*.svg masters (asset production)
  build <slug>                 Build dist/<slug> (images, CSS, crawl files)
  check <slug> [--only a,b]    Run the QA gates; exits 1 if any fail
  review <slug>                Write reports/<slug>/report.html
  deploy <slug> [--production] Ship to public/<slug> (preview by default)
  run <slug>                   art → build → check → review
  list                         Projects and their last QA result

Gates: brief, content, design, lint, a11y, responsive, browsers, seo, taste, perf
(taste runs when TASTE_SKILL_DIR points at the Taste skill's folder)`;

const [cmd, slug, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const option = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

async function requireProject() {
  if (!slug) throw new Error('Name a project: npm run site -- <command> <slug>');
  await stat(projectDir(slug)).catch(() => {
    throw new Error(`No project "${slug}" in projects/`);
  });
}

const commands = {
  async new() {
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error('Give a slug in lowercase-with-dashes');
    const exists = await stat(projectDir(slug)).then(() => true, () => false);
    if (exists) throw new Error(`projects/${slug} already exists`);
    await cp(join(ROOT, 'templates', 'project'), projectDir(slug), { recursive: true });
    const name = rest[0] ?? slug;
    for (const f of ["brief.yaml", "src/index.html", "DESIGN.md"]) {
      const p = join(projectDir(slug), f);
      await writeFile(p, (await readFile(p, 'utf8')).replaceAll('{{name}}', name).replaceAll('{{slug}}', slug));
    }
    log.ok('new', `projects/${slug}: fill in brief.yaml first; the brief gate blocks everything else until it passes`);
  },
  async art() {
    await requireProject();
    await (await import('../stages/art.mjs')).renderArt(slug);
  },
  async build() {
    await requireProject();
    await (await import('../stages/build.mjs')).build(slug);
  },
  async check() {
    await requireProject();
    const only = option('only')?.split(',');
    const res = await (await import('../stages/qa/index.mjs')).runQa(slug, only);
    log.head(res.passed ? 'All gates passed.' : 'QA failed. Fix the findings above and run again.');
    process.exitCode = res.passed ? 0 : 1;
  },
  async review() {
    await requireProject();
    await (await import('../stages/review.mjs')).review(slug);
  },
  async deploy() {
    await requireProject();
    await (await import('../stages/deploy.mjs')).deploy(slug, { production: flag('production') });
  },
  async run() {
    await requireProject();
    await commands.art();
    await commands.build();
    await commands.check();
    await commands.review();
  },
  async list() {
    for (const p of await readdir(join(ROOT, 'projects'))) {
      const r = JSON.parse(await readFile(join(ROOT, 'reports', p, 'results.json'), 'utf8').catch(() => 'null'));
      console.log(`${p.padEnd(24)} ${r ? `${r.passed ? 'passed' : 'FAILED'} ${r.at}` : 'not checked'}`);
    }
  },
};

const run = commands[cmd];
if (!run) {
  console.log(HELP);
  process.exit(cmd ? 1 : 0);
}
run().catch((e) => {
  log.fail(cmd, e.message);
  process.exit(1);
});
