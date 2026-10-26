// Stage 1 · Brief gate. Nothing is designed until the brief names the goal, the audience, the
// client's own material and a sign-off.
import { join } from 'node:path';
import { projectDir, readYaml, result } from './lib/util.mjs';

const REQUIRED = [
  'client.name',
  'client.kind',
  'site.url',
  'site.locale',
  'goal.primary_action',
  'goal.success',
  'goal.first_question',
  'audience',
  'mode',
  'inventory',
  'idea',
  'sign_off.brief.by',
];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export async function briefGate(slug) {
  const findings = [];
  let brief;
  try {
    brief = await readYaml(join(projectDir(slug), 'brief.yaml'));
  } catch (e) {
    return result('brief', [{ level: 'fail', message: `brief.yaml is missing or invalid: ${e.message}` }]);
  }

  for (const key of REQUIRED) {
    const v = get(brief, key);
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) findings.push({ level: 'fail', message: `Missing ${key}` });
  }
  if (JSON.stringify(brief).match(/\bTODO\b|\bTBD\b/)) findings.push({ level: 'fail', message: 'The brief still has a TODO or TBD' });
  if (!['persuade', 'operate', 'read', 'experience'].includes(brief.mode))
    findings.push({ level: 'fail', message: `mode must be persuade, operate, read or experience (got ${brief.mode})` });
  if ((brief.inventory ?? []).length < 5)
    findings.push({ level: 'warn', message: 'Inventory has fewer than five things only this client has; the idea will come from the category' });
  try {
    new URL(brief.site?.url);
  } catch {
    findings.push({ level: 'fail', message: 'site.url is not an absolute URL' });
  }
  if (brief.client?.status === 'sample')
    findings.push({ level: 'warn', message: 'Sample project: illustrative content must be replaced before a real launch' });

  return result('brief', findings, { client: brief.client?.name, mode: brief.mode });
}
