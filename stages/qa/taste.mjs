// QA · Taste inspector (optional). When the Taste skill is installed, run its own source lint and
// real-browser inspector on the build: headline line counts, eyebrows, blank stretches, margins,
// motion count and the rest of its house rules. Point TASTE_SKILL_DIR at the skill's folder
// (the one holding SKILL.md). Without it, this gate is skipped.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, chmod, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../lib/serve.mjs';
import { distDir, projectDir, reportDir, result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

const run = promisify(execFile);

export async function tasteGate(slug) {
  const dir = process.env.TASTE_SKILL_DIR;
  if (!dir) return { name: 'taste', status: 'skip', findings: [{ level: 'warn', message: 'TASTE_SKILL_DIR is not set; the Taste inspector did not run' }] };
  const cfg = await loadConfig(slug);
  const findings = [];
  const out = join(reportDir(slug), 'taste');
  await mkdir(out, { recursive: true });

  // Chromium refuses to run as root without --no-sandbox (CI containers); wrap it.
  const wrapper = join(out, 'chrome.sh');
  await writeFile(wrapper, `#!/bin/sh\nexec "${process.env.CHROME_PATH || chromium.executablePath()}" --no-sandbox "$@"\n`);
  await chmod(wrapper, 0o755);
  const env = { ...process.env, CHROME_PATH: wrapper };

  const parse = (stdout, tool) => {
    let section = null;
    for (const line of stdout.split('\n')) {
      if (/^FAIL\b/.test(line)) section = 'fail';
      else if (/^WARN\b/.test(line)) section = 'warn';
      else if (/^(LOOK|RESULT|report:)/.test(line)) section = null;
      const m = line.match(/^\s+\[([\w-]+)\]\s+(.*)$/);
      if (section && m) findings.push({ level: section, where: tool, message: `${m[1]}: ${m[2]}` });
    }
  };

  const lint = await run(process.execPath, [join(dir, 'scripts', 'lint.mjs'), join(projectDir(slug), 'src')], { env }).catch((e) => e);
  parse(lint.stdout ?? '', 'taste lint');

  const server = await serve(distDir(slug));
  try {
    const insp = await run(process.execPath, [join(dir, 'scripts', 'inspect.mjs'), server.url, '--out', out], { env, timeout: 300000 }).catch((e) => e);
    if (!insp.stdout) findings.push({ level: 'fail', message: `Inspector did not run: ${insp.message}` });
    parse(insp.stdout ?? '', 'taste inspect');
  } finally {
    await server.close();
  }
  return result('taste', applyWaivers('taste', findings, cfg.waivers));
}
