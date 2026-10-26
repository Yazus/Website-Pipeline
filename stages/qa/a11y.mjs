// QA · Accessibility. axe-core (WCAG 2.2 AA + best practices) at phone, tablet and desktop widths,
// with and without reduced motion, plus a keyboard walk: every stop is reachable, visibly focused,
// on screen, and the walk never traps.
import AxeBuilder from '@axe-core/playwright';
import { openSite, scrollThrough, newPage } from '../lib/browser.mjs';
import { result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

export async function a11yGate(slug) {
  const cfg = await loadConfig(slug);
  const site = await openSite(slug);
  const findings = [];
  const seen = new Set();
  let keyboardStops = 0;

  try {
    for (const path of cfg.pages) {
      for (const width of cfg.reviewViewports) {
        for (const reducedMotion of ['no-preference', 'reduce']) {
          const page = await newPage(site.browser, { viewport: { width, height: 900 }, reducedMotion });
          await page.goto(new URL(path.replace(/^\//, ''), site.url).href, { waitUntil: 'networkidle' });
          await scrollThrough(page);
          // Let entrance transitions settle so axe measures final colours, not a half-faded frame.
          await page.waitForTimeout(900);
          const res = await new AxeBuilder({ page }).withTags(cfg.a11y.tags).analyze();
          for (const v of res.violations) {
            if (!cfg.a11y.failOn.includes(v.impact)) continue;
            const key = `${v.id}:${v.nodes.map((n) => n.target.join(' ')).join('|')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            findings.push({
              level: 'fail',
              where: `${path} @${width}px`,
              message: `${v.id} (${v.impact}): ${v.help}, on ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`,
            });
          }
          await page.close();
        }
      }

      // Keyboard walk at desktop width.
      const page = await newPage(site.browser, { viewport: { width: 1440, height: 900 } });
      await page.goto(new URL(path.replace(/^\//, ''), site.url).href, { waitUntil: 'networkidle' });
      const focusable = await page.evaluate(
        () =>
          [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(
            (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden',
          ).length,
      );
      const visited = new Set();
      for (let i = 0; i < focusable + 5; i++) {
        await page.keyboard.press('Tab');
        // Wait for focus scrolling (smooth or not) to settle before judging position.
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              let last = -1, still = 0;
              const t0 = performance.now();
              const check = () => {
                still = scrollY === last ? still + 1 : 0;
                last = scrollY;
                if (still >= 4 || performance.now() - t0 > 1500) return resolve();
                requestAnimationFrame(check);
              };
              requestAnimationFrame(check);
            }),
        );
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
          return {
            id: el.outerHTML.slice(0, 120),
            label,
            outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
            onScreen: r.bottom > 0 && r.top < innerHeight && r.width > 0,
          };
        });
        if (!info) break; // walked off the end of the document: no trap
        if (visited.has(info.id)) break;
        visited.add(info.id);
        if (!info.outline) findings.push({ level: 'fail', where: path, message: `No visible focus indicator on "${info.label}"` });
        if (!info.onScreen) findings.push({ level: 'fail', where: path, message: `Focused element is off screen: "${info.label}"` });
      }
      keyboardStops = visited.size;
      if (visited.size < Math.min(focusable, 3)) findings.push({ level: 'fail', where: path, message: `Keyboard reached ${visited.size} of ${focusable} controls` });
      await page.close();
    }
  } finally {
    await site.close();
  }
  return result('a11y', applyWaivers('a11y', findings, cfg.waivers), { keyboardStops });
}
