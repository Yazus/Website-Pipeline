// Stage 3 · Design-system gate. Reads the project's stylesheet and holds it to:
//  - its own tokens: every colour pair the project declares meets WCAG contrast
//  - the craft floor (Impeccable): themed selection, focus and scrollbars, reduced-motion fallback
//  - the anti-template rules (Taste): no gradients, glass, monospace costume, tracked tiny caps,
//    eyebrow labels, index numbering, card grids of icons
//  - motion rules (Emil Kowalski): no `transition: all`, no ease-in on UI, nothing scales from 0,
//    feedback on press
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { projectDir, result } from './lib/util.mjs';
import { loadConfig, applyWaivers } from './lib/config.mjs';

const hex = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

export async function designGate(slug) {
  const cfg = await loadConfig(slug);
  const src = join(projectDir(slug), 'src');
  const cssFiles = (await readdir(src)).filter((f) => f.endsWith('.css'));
  const css = (await Promise.all(cssFiles.map((f) => readFile(join(src, f), 'utf8')))).join('\n');
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const htmlFiles = (await readdir(src)).filter((f) => f.endsWith('.html'));
  const html = (await Promise.all(htmlFiles.map((f) => readFile(join(src, f), 'utf8')))).join('\n');
  const findings = [];
  const fail = (message) => findings.push({ level: 'fail', message });
  const warn = (message) => findings.push({ level: 'warn', message });

  // Tokens.
  const root = code.match(/:root\s*{([\s\S]*?)}/)?.[1] ?? '';
  const tokens = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\b/gi)].map((m) => [m[1], m[2]]));
  if (Object.keys(tokens).length < 3) fail('Fewer than three colour tokens on :root; the palette is not a system');

  // Colours used outside :root must be tokens (art and SVG excepted).
  const body = code.replace(/:root\s*{[\s\S]*?}/, '');
  const stray = [...new Set(body.match(/#[0-9a-f]{3,6}\b/gi) ?? [])];
  if (stray.length) warn(`Raw colours outside the tokens: ${stray.join(', ')}`);

  // Contrast for every declared pair: design.pairs in pipeline.yaml, as [fg, bg, minimum].
  const pairs = cfg.design.pairs ?? [['ink', 'bg', 4.5]];
  const ratios = {};
  for (const [fg, bg, min] of pairs) {
    if (!tokens[fg] || !tokens[bg]) {
      fail(`Contrast pair ${fg}/${bg} names a token that does not exist`);
      continue;
    }
    const r = contrast(tokens[fg], tokens[bg]);
    ratios[`${fg} on ${bg}`] = Number(r.toFixed(2));
    if (r < min) fail(`${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
  }

  // Type: two families at most, no monospace costume.
  const families = new Set(
    [...code.matchAll(/font-family:\s*([^;]+);/g)]
      .map((m) => m[1].split(',')[0].trim().replace(/["']/g, ''))
      .filter((f) => !f.startsWith('var(') && !['inherit', 'initial', 'unset'].includes(f)),
  );
  if (families.size > 2) fail(`More than two font families: ${[...families].join(', ')}`);
  if (/monospace|\bmono\b/i.test(code.replace(/pre|code/g, ''))) fail('Monospace outside code blocks');
  if (/text-transform:\s*uppercase[^}]*letter-spacing:\s*0?\.\d+em|letter-spacing:\s*0?\.[1-9]\d*em[^}]*text-transform:\s*uppercase/.test(code))
    fail('Tiny tracked uppercase labels (letter-spacing on uppercase text)');

  // Surfaces.
  if (/(linear|radial|conic)-gradient\(/.test(code)) fail('CSS gradient (use flat colour or a real picture)');
  if (/backdrop-filter/.test(code)) fail('Glass (backdrop-filter) as decoration');
  if (/box-shadow:\s*\d+px\s+\d+px\s+0\b/.test(code)) fail('Hard offset shadow');
  if (/box-shadow:(?!\s*none)/.test(code)) warn('Shadows found: only things that float (menus, dialogs) should cast one');
  if (/border-(left|right):\s*([2-9]|\d{2,})px/.test(code)) fail('Thick coloured side border on a block');
  if (/background-clip:\s*text/.test(code)) fail('Gradient or clipped text');

  // Browser surfaces (Impeccable craft floor).
  if (!/::selection/.test(code)) fail('Text selection is left at the browser default');
  if (!/:focus-visible/.test(code)) fail('No :focus-visible style; keyboard focus uses the browser default');
  if (!/scrollbar-color|::-webkit-scrollbar/.test(code)) warn('Scrollbars are left at the browser default');
  if (!/tabular-nums/.test(code) && /£|\$|€|\d+:\d\d/.test(html)) warn('Prices or times without tabular figures');

  // Motion (Emil Kowalski).
  if (/transition:\s*all\b/.test(code)) fail('`transition: all` animates layout by accident; name the properties');
  if (/\bease-in\b(?!-out)/.test(code)) fail('ease-in on UI motion feels sluggish; use a strong ease-out');
  if (/scale\(0\)|scale:\s*0[;\s]/.test(code)) fail('Something scales from 0; start at 0.9 or higher with opacity');
  const animates = /animation:|transition:/.test(code);
  if (animates && !/prefers-reduced-motion/.test(code)) fail('Motion without a prefers-reduced-motion fallback');
  if (!/:active[^{]*{[^}]*scale/.test(code)) warn('Buttons give no press feedback (scale on :active)');
  const durations = [...code.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
  if (durations.some((d) => d > 1200)) warn('A transition longer than 1.2s');

  // Markup tells (Taste).
  const { document } = parseHTML(html);
  document.querySelectorAll('h1, h2, h3').forEach((h) => {
    const prev = h.previousElementSibling;
    if (prev && /^(p|span|div|small)$/i.test(prev.tagName) && prev.textContent.trim().split(/\s+/).length <= 4 && prev.textContent === prev.textContent.toUpperCase())
      fail(`Eyebrow label above "${h.textContent.trim().slice(0, 40)}"`);
    if (/^\s*0\d\b|^\s*\(0\d+\)/.test(h.textContent)) fail(`Index numbering in heading "${h.textContent.trim().slice(0, 40)}"`);
  });
  if (/\p{Emoji_Presentation}/u.test(document.body?.textContent ?? '')) fail('Emoji standing in for icons or emphasis');
  if (/lorem|ipsum/i.test(html)) fail('Lorem ipsum in source');

  return result('design', applyWaivers('design', findings, cfg.waivers), { tokens, ratios, families: [...families] });
}
