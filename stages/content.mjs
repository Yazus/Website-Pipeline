// Stage 2 · Content gate. Runs on the built pages: real words, no placeholders, no stock phrases,
// no invented proof, headlines short enough to set large.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { distDir, projectDir, readYaml, result } from './lib/util.mjs';

const PLACEHOLDERS = /lorem ipsum|dolor sit amet|\bTODO\b|\bTBD\b|\bFIXME\b|placeholder|your (?:company|brand|name) here|example\.com\b|\[insert/i;

// Phrases that mark copy as generated rather than written for this client.
const STOCK = [
  'elevate', 'unlock', 'seamless', 'seamlessly', 'curated', 'game-changer', 'game changer', 'cutting-edge',
  'world-class', 'best-in-class', 'next-level', 'look no further', "whether you're", 'whether you are',
  'in today\'s', 'delve', 'testament to', 'nestled', 'embark', 'journey', 'vibrant', 'immerse',
  'experience the difference', 'passion for', 'we pride ourselves', 'one-stop', 'synergy', 'revolutionize',
  'revolutionise', 'empower', 'transformative', 'unparalleled', 'state-of-the-art', 'tapestry',
];

// Proof must be real. Sample projects may not show any of it.
const PROOF = /testimonial|review|★|⭐|\d(?:\.\d)?\s*\/\s*5\b|as seen in|trusted by|\d{2,}[,.]?\d*\+?\s*(?:happy )?(?:customers|clients|users)/i;

export async function contentGate(slug) {
  const brief = await readYaml(join(projectDir(slug), 'brief.yaml'));
  const out = distDir(slug);
  const pages = (await readdir(out)).filter((f) => f.endsWith('.html'));
  const findings = [];

  for (const page of pages) {
    const { document } = parseHTML(await readFile(join(out, page), 'utf8'));
    document.querySelectorAll('script, style').forEach((n) => n.remove());
    const text = document.body.textContent.replace(/\s+/g, ' ');
    const where = page;

    const ph = text.match(PLACEHOLDERS);
    if (ph) findings.push({ level: 'fail', where, message: `Placeholder text: "${ph[0]}"` });

    for (const phrase of STOCK) {
      const re = new RegExp(`\\b${phrase.replace(/[-']/g, '.')}\\b`, 'i');
      if (re.test(text)) findings.push({ level: 'fail', where, message: `Stock phrase: "${phrase}"` });
    }

    const proof = text.match(PROOF);
    if (proof) {
      findings.push({
        level: brief.client?.status === 'sample' ? 'fail' : 'warn',
        where,
        message: `Social proof found ("${proof[0]}"). ${brief.client?.status === 'sample' ? 'A sample project may not invent proof.' : 'Confirm it is real and attributed.'}`,
      });
    }

    // Headlines: short enough to set large (Taste copy rule: ~32 characters is safe everywhere).
    document.querySelectorAll('h1, h2, h3').forEach((h) => {
      const t = (h.getAttribute('aria-label') || h.textContent).replace(/\s+/g, ' ').trim();
      if (t.length > 48) findings.push({ level: 'warn', where, message: `Long headline (${t.length} chars): "${t}"` });
    });

    // Every control names its action.
    document.querySelectorAll('a, button').forEach((el) => {
      const name = (el.getAttribute('aria-label') || el.textContent).trim().toLowerCase();
      if (['click here', 'here', 'read more', 'learn more', 'more'].includes(name))
        findings.push({ level: 'fail', where, message: `Vague link text: "${name}"` });
    });

    const words = text.split(' ').filter(Boolean).length;
    if (words < 150) findings.push({ level: 'warn', where, message: `Only ${words} words on the page; thin sections lose to full ones` });
  }

  return result('content', findings, { pages: pages.length });
}
