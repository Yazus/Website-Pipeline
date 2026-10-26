import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const projectDir = (slug) => join(ROOT, 'projects', slug);
export const distDir = (slug) => join(ROOT, 'dist', slug);
export const reportDir = (slug) => join(ROOT, 'reports', slug);

export async function readYaml(path) {
  return parse(await readFile(path, 'utf8'));
}

const c = (n) => (s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const green = c(32), red = c(31), yellow = c(33), dim = c(2);

export const log = {
  ok: (stage, msg) => console.log(`${green('✓')} ${dim(stage.padEnd(12))} ${msg}`),
  fail: (stage, msg) => console.log(`${red('✗')} ${dim(stage.padEnd(12))} ${msg}`),
  warn: (stage, msg) => console.log(`${yellow('!')} ${dim(stage.padEnd(12))} ${msg}`),
  skip: (stage, msg) => console.log(`${dim('–')} ${dim(stage.padEnd(12))} ${dim(msg)}`),
  head: (msg) => console.log(`\n${msg}`),
};

/**
 * A gate returns { name, status: 'pass'|'fail'|'warn'|'skip', findings: [{level, message, where?}], data? }.
 * This helper builds one from a findings list.
 */
export function result(name, findings, data) {
  const status = findings.some((f) => f.level === 'fail')
    ? 'fail'
    : findings.some((f) => f.level === 'warn')
      ? 'warn'
      : 'pass';
  return { name, status, findings, data };
}
