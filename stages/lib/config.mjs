import { join } from 'node:path';
import defaults from '../../pipeline.config.mjs';
import { projectDir, readYaml } from './util.mjs';

/** Studio defaults merged with the project's pipeline.yaml (qa section) and its waivers. */
export async function loadConfig(slug) {
  const project = (await readYaml(join(projectDir(slug), 'pipeline.yaml')).catch(() => null)) ?? {};
  const qa = project.qa ?? {};
  return {
    ...defaults,
    ...qa,
    a11y: { ...defaults.a11y, ...qa.a11y },
    responsive: { ...defaults.responsive, ...qa.responsive },
    lighthouse: { ...defaults.lighthouse, ...qa.lighthouse },
    seo: { ...defaults.seo, ...qa.seo },
    pages: qa.pages ?? ['/'],
    design: project.design ?? {},
    waivers: project.waivers ?? [],
    build: project.build ?? {},
  };
}

/** A waiver turns a named finding into a warning, and the review report lists it with its reason. */
export function applyWaivers(gate, findings, waivers) {
  return findings.map((f) => {
    const w = waivers.find((w) => w.gate === gate && f.message.includes(w.match));
    return w && f.level === 'fail' ? { ...f, level: 'warn', message: `${f.message} (waived: ${w.reason})` } : f;
  });
}
