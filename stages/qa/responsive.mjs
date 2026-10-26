// QA · Responsive. Every page at every studio width: no sideways scroll, no text below the legible
// floor, touch targets big enough, headings within two lines, nothing hidden by a failed entrance.
// Saves viewport and full-page screenshots for the review report.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openSite, scrollThrough, newPage } from '../lib/browser.mjs';
import { reportDir, result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

export async function responsiveGate(slug) {
  const cfg = await loadConfig(slug);
  const shotsDir = join(reportDir(slug), 'shots');
  await mkdir(shotsDir, { recursive: true });
  const site = await openSite(slug);
  const findings = [];
  const shots = [];
  const r = cfg.responsive;

  try {
    for (const path of cfg.pages) {
      const name = path === '/' ? 'home' : path.replace(/\W+/g, '-').replace(/^-|-$/g, '');
      for (const width of cfg.viewports) {
        const height = width < 768 ? 844 : 900;
        const page = await newPage(site.browser, { viewport: { width, height }, deviceScaleFactor: 1 });
        await page.goto(new URL(path.replace(/^\//, ''), site.url).href, { waitUntil: 'networkidle' });
        await scrollThrough(page);
        await page.waitForTimeout(800);
        const where = `${path} @${width}px`;

        const m = await page.evaluate(
          ({ minFontPx, minTargetPx, comfortableTargetPx, maxHeadingLines, width }) => {
            const out = { overflow: 0, smallText: [], smallTargets: [], tightTargets: [], longHeadings: [], hidden: [], noDims: [] };
            const doc = document.documentElement;
            out.overflow = doc.scrollWidth - doc.clientWidth;
            const visible = (el) => {
              const cs = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only, [aria-hidden="true"]');
            };
            // Text size: every element that directly holds text.
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const seen = new Set();
            while (walker.nextNode()) {
              const el = walker.currentNode.parentElement;
              if (!walker.currentNode.textContent.trim() || seen.has(el) || !visible(el)) continue;
              seen.add(el);
              const size = parseFloat(getComputedStyle(el).fontSize);
              if (size < minFontPx) out.smallText.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${size}px`);
            }
            // Targets (WCAG 2.2 SC 2.5.8; inline links in running text are exempt).
            for (const el of document.querySelectorAll('a[href], button, summary, input, select, textarea')) {
              if (!visible(el)) continue;
              const rect = el.getBoundingClientRect();
              const inline = getComputedStyle(el).display === 'inline' && el.closest('p, li') && el.closest('p, li').textContent.trim() !== el.textContent.trim();
              if (inline) continue;
              const label = (el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 30);
              const small = Math.min(rect.width, rect.height);
              if (small < minTargetPx) out.smallTargets.push(`"${label}" ${Math.round(rect.width)}×${Math.round(rect.height)}`);
              else if (width < 768 && small < comfortableTargetPx) out.tightTargets.push(`"${label}" ${Math.round(rect.width)}×${Math.round(rect.height)}`);
            }
            // Headings: two lines at most (Taste house rule).
            for (const h of document.querySelectorAll('h1, h2, h3, .stair__line')) {
              if (!visible(h) && !h.matches('h1')) continue;
              // Lines are counted from the text actually painted: screen-reader-only copies are skipped,
              // and boxes whose vertical centres sit within half a line of each other share a line.
              const centres = [];
              const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
              while (tw.nextNode()) {
                const node = tw.currentNode;
                if (!node.textContent.trim() || node.parentElement.closest('.sr-only')) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) if (rect.width > 1) centres.push({ c: rect.top + rect.height / 2, h: rect.height });
              }
              centres.sort((a, b) => a.c - b.c);
              let lines = 0, last = -Infinity;
              for (const { c, h: lh } of centres) if (c - last > lh / 2) { lines++; last = c; }
              if (lines > maxHeadingLines) out.longHeadings.push(`"${h.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}" ${lines} lines`);
            }
            // Content that stayed invisible after scrolling (an entrance that never fired).
            for (const el of document.querySelectorAll('main *, footer *')) {
              const cs = getComputedStyle(el);
              if (cs.opacity === '0' && el.getBoundingClientRect().height > 0 && el.textContent.trim()) out.hidden.push(`${el.tagName.toLowerCase()}.${el.className}`);
            }
            for (const img of document.images) if (!img.getAttribute('width') || !img.getAttribute('height')) out.noDims.push(img.currentSrc || img.src);
            return out;
          },
          { ...r, width },
        );

        if (m.overflow > 0) findings.push({ level: 'fail', where, message: `Page scrolls sideways by ${m.overflow}px` });
        for (const t of m.smallText.slice(0, 5)) findings.push({ level: 'fail', where, message: `Text below ${r.minFontPx}px: ${t}` });
        for (const t of m.smallTargets.slice(0, 5)) findings.push({ level: 'fail', where, message: `Target under ${r.minTargetPx}px: ${t}` });
        for (const t of m.tightTargets.slice(0, 5)) findings.push({ level: 'warn', where, message: `Touch target under ${r.comfortableTargetPx}px: ${t}` });
        for (const t of m.longHeadings) findings.push({ level: 'fail', where, message: `Heading over ${r.maxHeadingLines} lines: ${t}` });
        if (m.hidden.length) findings.push({ level: 'fail', where, message: `Still invisible after scrolling: ${m.hidden.slice(0, 4).join(', ')}` });
        for (const s of m.noDims) findings.push({ level: 'warn', where, message: `Image without width/height (layout shift): ${s}` });

        if (cfg.reviewViewports.includes(width)) {
          const file = `${name}-${width}.png`;
          await page.screenshot({ path: join(shotsDir, file) });
          // The full page, with sticky and scroll-linked layers in their resting state.
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.addStyleTag({ content: '.footer{position:static!important}' });
          const full = `${name}-${width}-full.png`;
          await page.screenshot({ path: join(shotsDir, full), fullPage: true });
          shots.push({ page: path, width, file, full });
        }
        await page.close();
      }
    }
  } finally {
    await site.close();
  }
  // Collapse repeats of the same finding across widths into one line per message.
  const merged = new Map();
  for (const f of applyWaivers('responsive', findings, cfg.waivers)) {
    const k = `${f.level}|${f.message}`;
    if (merged.has(k)) merged.get(k).where += `, ${f.where.split('@')[1]}`;
    else merged.set(k, { ...f });
  }
  return result('responsive', [...merged.values()], { shots, viewports: cfg.viewports });
}
