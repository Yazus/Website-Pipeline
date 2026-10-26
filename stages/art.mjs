// Stage: asset production.
// Renders every projects/<slug>/art/*.svg to a transparent PNG master in art/out/,
// with the project's own fonts available, so drawn artwork can use the brand type.
// The build stage then turns each master into responsive AVIF/WebP.
import { chromium } from 'playwright';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { projectDir, log } from './lib/util.mjs';

export async function renderArt(slug) {
  const dir = projectDir(slug);
  const artDir = join(dir, 'art');
  const outDir = join(artDir, 'out');
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(artDir)).filter((f) => f.endsWith('.svg'));
  if (!files.length) return log.skip('art', 'no art/*.svg to render');

  const fontsDir = join(dir, 'src', 'fonts');
  const fonts = (await readdir(fontsDir).catch(() => [])).filter((f) => f.endsWith('.woff2'));
  const faces = await Promise.all(
    fonts.map(async (f) => {
      const b64 = (await readFile(join(fontsDir, f))).toString('base64');
      // Naming convention: <family>[-<weight>].woff2
      const [family, weight] = basename(f, '.woff2').split('-');
      const fam = family[0].toUpperCase() + family.slice(1);
      return `@font-face{font-family:'${fam}';font-weight:${weight || '100 900'};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
    }),
  );

  const browser = await chromium.launch();
  try {
    for (const file of files) {
      const svg = await readFile(join(artDir, file), 'utf8');
      const w = Number(svg.match(/width="(\d+)"/)[1]);
      const h = Number(svg.match(/height="(\d+)"/)[1]);
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.setContent(
        `<style>${faces.join('')}html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
      );
      await page.evaluate(() => document.fonts.ready);
      const out = join(outDir, basename(file, '.svg') + '.png');
      await page.screenshot({ path: out, omitBackground: true });
      await page.close();
      log.ok('art', `${file} → ${w}×${h}`);
    }
  } finally {
    await browser.close();
  }
}
