// Fast checks on the gates themselves (no browser): run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { contrast } from '../stages/design.mjs';
import { briefGate } from '../stages/brief.mjs';
import { projectDir } from '../stages/lib/util.mjs';

const run = promisify(execFile);

test('contrast matches WCAG reference values', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
});

test('a fresh project is blocked at the brief gate until it is filled in', async () => {
  const slug = 'zz-template-check';
  await rm(projectDir(slug), { recursive: true, force: true });
  try {
    await run(process.execPath, ['bin/site.mjs', 'new', slug, 'Template Check']);
    const res = await briefGate(slug);
    assert.equal(res.status, 'fail');
    assert.ok(res.findings.some((f) => f.message.includes('TODO')));
  } finally {
    await rm(projectDir(slug), { recursive: true, force: true });
  }
});

test('the example project has a complete brief', async () => {
  await stat(projectDir('forty-grams'));
  const res = await briefGate('forty-grams');
  assert.notEqual(res.status, 'fail', JSON.stringify(res.findings));
});
