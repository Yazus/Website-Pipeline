// QA · Code lint: HTML validity (html-validate), CSS (stylelint), JavaScript syntax.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HtmlValidate } from 'html-validate';
import stylelint from 'stylelint';
import { distDir, projectDir, ROOT, result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

const run = promisify(execFile);

export async function lintGate(slug) {
  const cfg = await loadConfig(slug);
  const findings = [];
  const out = distDir(slug);
  const src = join(projectDir(slug), 'src');

  // HTML: validate what ships.
  const htmlvalidate = new HtmlValidate({
    extends: ['html-validate:recommended'],
    rules: {
      'no-inline-style': 'off', // the build inlines the stylesheet into <style>
      'long-title': ['error', { maxlength: 70 }],
      'no-trailing-whitespace': 'off',
      'doctype-style': ['error', { style: 'lowercase' }],
    },
  });
  for (const page of (await readdir(out)).filter((f) => f.endsWith('.html'))) {
    const report = await htmlvalidate.validateFile(join(out, page));
    for (const r of report.results)
      for (const m of r.messages)
        findings.push({ level: m.severity === 2 ? 'fail' : 'warn', where: `${page}:${m.line}`, message: `html ${m.ruleId}: ${m.message}` });
  }

  // CSS: the authored source.
  const css = await stylelint.lint({
    files: join(src, '**/*.css'),
    configBasedir: ROOT,
    config: {
      extends: ['stylelint-config-standard'],
      rules: {
        'selector-class-pattern': null, // BEM-style names are fine
        'custom-property-pattern': null,
        'no-descending-specificity': null,
        'declaration-empty-line-before': null,
        'custom-property-empty-line-before': null, // tokens are grouped by role
        'rule-empty-line-before': null,
        'value-keyword-case': ['lower', { ignoreKeywords: ['currentColor'] }],
        'property-no-unknown': [true, { ignoreProperties: ['interpolate-size'] }],
        'declaration-property-value-no-unknown': null,
      },
    },
  });
  for (const r of css.results)
    for (const w of r.warnings)
      findings.push({
        level: w.severity === 'error' ? 'fail' : 'warn',
        where: `${r.source.replace(ROOT + '/', '')}:${w.line}`,
        message: `css ${w.text}`,
      });

  // JavaScript: every file parses.
  for (const f of (await readdir(src)).filter((f) => /\.m?js$/.test(f))) {
    try {
      await run(process.execPath, ['--check', join(src, f)]);
    } catch (e) {
      findings.push({ level: 'fail', where: f, message: `js syntax: ${e.stderr.split('\n').find((l) => l.includes('Error')) ?? e.message}` });
    }
  }

  return result('lint', applyWaivers('lint', findings, cfg.waivers));
}
