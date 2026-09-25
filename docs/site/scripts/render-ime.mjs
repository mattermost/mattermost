#!/usr/bin/env node
/**
 * Render each IME diagram variant to a PNG.
 *
 * Boots a headless Chromium via Playwright, navigates to a route that
 * mounts a single variant of `<IMEDiagram content={...} />`, waits for
 * the diagram to settle, and screenshots the `.diagram` element at 2x.
 *
 * The route needs to exist in the site. We piggy-back on the docs
 * landing page and a query string handled by the component's default
 * export: `/?imeVariant=<id>&imeExport=1` hides the toggle and shows
 * only the requested variant. If we later want a dedicated route,
 * point BASE_URL somewhere else.
 *
 * Usage:
 *   npm run docusaurus start &          # or `serve` against a built site
 *   npm run render:ime                  # installs chromium then renders every variant
 *   node scripts/render-ime.mjs entadv  # renders one variant (assumes chromium is installed)
 *
 * Playwright ships as a devDependency; `npm run render:ime` also runs
 * `playwright install chromium` first so a fresh checkout works.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'static', 'img', 'ime');
const BASE_URL = process.env.IME_BASE_URL || 'http://localhost:3000';
const VARIANTS = ['entadv'];

async function main() {
  const filter = process.argv[2];
  const targets = filter ? VARIANTS.filter((v) => v === filter) : VARIANTS;
  if (targets.length === 0) {
    console.error(`Unknown variant: ${filter}. Known: ${VARIANTS.join(', ')}`);
    process.exit(1);
  }

  let chromium;
  try {
    ({chromium} = await import('playwright'));
  } catch (err) {
    console.error('Playwright not installed. Run `npm install`, then `npx playwright install chromium`.');
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, {recursive: true});
  // Viewport width has to be wide enough that the diagram's wrapper
  // (max 1240px, minus the docs sidebar and reading-column padding)
  // stays above the 900px container-query breakpoint. Below that the
  // component collapses to a 2-column mobile layout and the resulting
  // PNG doesn't match what visitors see on desktop.
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: {width: 1728, height: 900},
    deviceScaleFactor: 2,
  });

  try {
    for (const variant of targets) {
      const url = `${BASE_URL}/?imeVariant=${variant}&imeExport=1`;
      console.log(`→ ${variant} :: ${url}`);
      const page = await context.newPage();
      await page.goto(url, {waitUntil: 'networkidle'});

      // Hide Docusaurus site chrome (navbar, sidebar, TOC, footer)
      // before screenshotting. Playwright's element screenshot captures
      // whatever pixels sit inside the element's bounding box, so any
      // `position: sticky` / `position: fixed` chrome above the
      // diagram bleeds into the output when the element is tall enough
      // that Playwright has to scroll to expose it.
      await page.addStyleTag({content: `
        .navbar, .theme-doc-sidebar-container, .theme-doc-toc-mobile,
        .theme-doc-toc-desktop, .theme-doc-footer, footer.footer,
        .pagination-nav { display: none !important; }
        .main-wrapper { padding-top: 0 !important; }
      `});

      // Wait for the *specific* variant to be committed to the DOM.
      // The initial paint is General, and networkidle can fire before
      // React commits the useEffect that switches to the URL-requested
      // variant, so a generic `[aria-label$="overview"]` selector would
      // capture the wrong diagram. `[data-variant]` is set on the
      // rendered variant's `<section>` by the component itself.
      const el = await page.waitForSelector(
        `[data-variant="${variant}"][data-ready="true"]`,
        {timeout: 15_000},
      );

      // `data-ready` fires as soon as React commits the variant, but
      // `<img>` elements and CSS background images (banner backdrop,
      // vendor logos) may still be decoding. Screenshotting before
      // they're painted produces a PNG with missing icons/backgrounds.
      // Wait for every image inside the section to load + decode.
      await el.evaluate(async (section) => {
        const decodeImg = async (img) => {
          if (!img.complete) {
            await new Promise((resolve, reject) => {
              img.addEventListener('load', resolve, {once: true});
              img.addEventListener('error', reject, {once: true});
            });
          }
          if (!img.naturalWidth) {
            throw new Error(`Failed to load ${img.currentSrc || img.src}`);
          }
          await img.decode();
        };

        // Inline <img> elements.
        const inlineImgs = Array.from(section.querySelectorAll('img'));
        await Promise.all(inlineImgs.map(decodeImg));

        // CSS background-image URLs across the section subtree.
        const bgUrls = [section, ...section.querySelectorAll('*')].flatMap((node) => {
          const bg = getComputedStyle(node).backgroundImage;
          return [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
        });
        await Promise.all([...new Set(bgUrls)].map((url) => new Promise((resolve, reject) => {
          const probe = new Image();
          probe.onload = () => probe.decode().then(resolve, reject);
          probe.onerror = reject;
          probe.src = url;
        })));
      });

      const out = path.join(OUT_DIR, `${variant}.png`);
      await el.screenshot({path: out, omitBackground: false});
      console.log(`  wrote ${path.relative(process.cwd(), out)}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
