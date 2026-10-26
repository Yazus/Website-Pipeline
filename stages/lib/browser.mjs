import * as pw from 'playwright';
import { serve } from './serve.mjs';
import { distDir } from './util.mjs';

/** Serve dist/<slug> and open a browser engine; callers get { url, browser } and must call close(). */
export async function openSite(slug, engine = 'chromium', launch = {}) {
  const server = await serve(distDir(slug));
  let browser;
  try {
    browser = await pw[engine].launch(launch);
  } catch (e) {
    await server.close();
    throw e;
  }
  return {
    url: server.url,
    browser,
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}

/** Scroll the whole page so lazy images load and every scroll-linked state is reached once. */
export async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 80));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(150);
}

export async function isEngineAvailable(engine) {
  try {
    const b = await pw[engine].launch();
    await b.close();
    return true;
  } catch {
    return false;
  }
}

/** A page in its own context (axe needs one); closing the page closes the context. */
export async function newPage(browser, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const close = page.close.bind(page);
  page.close = async () => {
    await close();
    await context.close();
  };
  return page;
}
