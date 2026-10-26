// Stage 4 · Build.
// projects/<slug>/src → dist/<slug>/: responsive images from the art masters, inlined and minified CSS,
// robots.txt and sitemap.xml from the brief's URL. The output is a static folder any host can serve.
import { cp, mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { transform, browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import { projectDir, distDir, readYaml, log } from './lib/util.mjs';

// Minify with Lightning CSS, which also adds the vendor prefixes our browser targets need.
const targets = browserslistToTargets(browserslist('> 0.5%, last 2 versions, Firefox ESR, not dead'));
const minifyCss = (css, filename) =>
  transform({ filename, code: Buffer.from(css), minify: true, targets }).code.toString();

export async function build(slug) {
  const src = join(projectDir(slug), 'src');
  const out = distDir(slug);
  const settings = (await readYaml(join(projectDir(slug), 'pipeline.yaml')).catch(() => ({}))) ?? {};
  const brief = await readYaml(join(projectDir(slug), 'brief.yaml'));
  const cfg = settings.build ?? {};

  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'img'), { recursive: true });
  await cp(src, out, { recursive: true });

  // Images: each art master becomes a set of WebP widths.
  const masters = join(projectDir(slug), 'art', 'out');
  let count = 0;
  for (const [name, widths] of Object.entries(cfg.images ?? {})) {
    const input = join(masters, `${name}.png`);
    await stat(input).catch(() => {
      throw new Error(`build: art master ${name}.png is missing; run the art stage first`);
    });
    for (const w of widths) {
      await sharp(input).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(join(out, 'img', `${name}-${w}.webp`));
      count++;
    }
  }
  for (const name of cfg.copy_png ?? []) {
    await sharp(join(masters, `${name}.png`)).png({ compressionLevel: 9, palette: true }).toFile(join(out, 'img', `${name}.png`));
  }
  log.ok('build', `${count} responsive images`);

  // CSS: minify, and inline into each page when asked (one fewer render-blocking request).
  const pages = (await readdir(out)).filter((f) => f.endsWith('.html'));
  const cssFiles = (await readdir(out)).filter((f) => f.endsWith('.css'));
  for (const f of cssFiles) await writeFile(join(out, f), minifyCss(await readFile(join(out, f), 'utf8'), f));
  for (const page of pages) {
    let html = await readFile(join(out, page), 'utf8');
    if (cfg.inline_css) {
      for (const f of cssFiles) {
        const css = await readFile(join(out, f), 'utf8');
        html = html.replace(new RegExp(`<link rel="stylesheet" href="${f}">`), `<style>${css}</style>`);
      }
    }
    await writeFile(join(out, page), html);
  }

  // Crawlers.
  const url = brief.site.url.replace(/\/?$/, '/');
  await writeFile(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n`);
  const today = new Date().toISOString().slice(0, 10);
  const locs = pages.map((p) => (p === 'index.html' ? url : url + p));
  await writeFile(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs
      .map((l) => `  <url><loc>${l}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  log.ok('build', `${pages.length} page(s), robots.txt, sitemap.xml → dist/${slug}`);
  return out;
}
