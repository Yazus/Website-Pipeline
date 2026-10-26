// QA · SEO and links. Static checks on what ships: title and description, canonical, language,
// one h1 and an unbroken heading outline, social cards, structured data, crawl files, image alt text,
// and every internal link and anchor resolving.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { distDir, projectDir, readYaml, result } from '../lib/util.mjs';
import { loadConfig, applyWaivers } from '../lib/config.mjs';

const exists = (p) => stat(p).then(() => true, () => false);

export async function seoGate(slug) {
  const cfg = await loadConfig(slug);
  const brief = await readYaml(join(projectDir(slug), 'brief.yaml'));
  const out = distDir(slug);
  const siteUrl = brief.site.url.replace(/\/?$/, '/');
  const findings = [];
  const pages = (await readdir(out)).filter((f) => f.endsWith('.html'));
  const data = {};

  for (const page of pages) {
    const where = page;
    const html = await readFile(join(out, page), 'utf8');
    const { document } = parseHTML(html);
    const fail = (message) => findings.push({ level: 'fail', where, message });
    const warn = (message) => findings.push({ level: 'warn', where, message });
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim();

    const title = document.querySelector('title')?.textContent.trim() ?? '';
    const [tMin, tMax] = cfg.seo.title;
    if (!title) fail('No <title>');
    else if (title.length < tMin || title.length > tMax) warn(`Title is ${title.length} characters (aim for ${tMin}–${tMax}): "${title}"`);

    const desc = meta('meta[name="description"]') ?? '';
    const [dMin, dMax] = cfg.seo.description;
    if (!desc) fail('No meta description');
    else if (desc.length < dMin || desc.length > dMax) warn(`Description is ${desc.length} characters (aim for ${dMin}–${dMax})`);

    if (!document.documentElement.getAttribute('lang')) fail('No lang on <html>');
    if (!document.querySelector('meta[name="viewport"]')) fail('No viewport meta');
    if (!document.querySelector('meta[charset]')) fail('No charset meta');

    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const expected = page === 'index.html' ? siteUrl : siteUrl + page;
    if (!canonical) fail('No canonical link');
    else if (canonical !== expected) warn(`Canonical is ${canonical}, expected ${expected}`);

    const h1s = document.querySelectorAll('h1');
    if (h1s.length !== 1) fail(`${h1s.length} h1 elements; a page has exactly one`);
    let prev = 1;
    for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      const level = Number(h.tagName[1]);
      if (level > prev + 1) fail(`Heading jumps from h${prev} to h${level}: "${h.textContent.trim().slice(0, 40)}"`);
      prev = level;
    }

    for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) if (!meta(`meta[property="${p}"]`)) fail(`No ${p}`);
    if (!meta('meta[name="twitter:card"]')) warn('No twitter:card');
    const ogImage = meta('meta[property="og:image"]');
    if (ogImage?.startsWith(siteUrl) && !(await exists(join(out, ogImage.slice(siteUrl.length))))) fail(`og:image file is missing: ${ogImage}`);

    // Structured data must parse and say what the business is.
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')];
    if (!ld.length) warn('No structured data (JSON-LD)');
    for (const s of ld) {
      try {
        const j = JSON.parse(s.textContent);
        if (!j['@context'] || !j['@type']) fail('JSON-LD without @context or @type');
        data.structuredData = j['@type'];
      } catch (e) {
        fail(`JSON-LD does not parse: ${e.message}`);
      }
    }

    if (!document.querySelector('link[rel~="icon"]')) warn('No favicon');

    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) fail(`Image without alt: ${img.getAttribute('src')}`);
    }

    // Links: anchors and local files resolve.
    const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
    for (const a of document.querySelectorAll('a[href], link[href], img[src], script[src], source[srcset], img[srcset]')) {
      const refs = [a.getAttribute('href'), a.getAttribute('src'), ...(a.getAttribute('srcset') ?? '').split(',').map((s) => s.trim().split(/\s+/)[0])].filter(Boolean);
      for (const ref of refs) {
        if (/^(mailto:|tel:|https?:|data:)/.test(ref)) continue;
        if (ref.startsWith('#')) {
          if (ref.length > 1 && !ids.has(ref.slice(1))) fail(`Link to missing anchor ${ref}`);
          continue;
        }
        const file = join(out, ref.split(/[?#]/)[0]);
        if (!(await exists(file))) fail(`Broken local reference: ${ref}`);
      }
    }
    for (const a of document.querySelectorAll('a[href^="mailto:"]')) {
      if (!/^mailto:[^@\s]+@[^@\s]+\.[^@\s?]+/.test(a.getAttribute('href'))) fail(`Malformed mailto: ${a.getAttribute('href')}`);
    }
    data.title = title;
    data.description = desc;
  }

  // Crawl files.
  const robots = await readFile(join(out, 'robots.txt'), 'utf8').catch(() => null);
  if (!robots) findings.push({ level: 'fail', message: 'No robots.txt' });
  else if (/Disallow:\s*\/\s*$/m.test(robots)) findings.push({ level: 'fail', message: 'robots.txt blocks the whole site' });
  const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8').catch(() => null);
  if (!sitemap) findings.push({ level: 'fail', message: 'No sitemap.xml' });
  else if (!sitemap.includes(`<loc>${siteUrl}</loc>`)) findings.push({ level: 'fail', message: 'sitemap.xml does not list the home page' });

  return result('seo', applyWaivers('seo', findings, cfg.waivers), data);
}
