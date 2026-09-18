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
 *   node scripts/render-ime.mjs         # renders every variant
 *   node scripts/render-ime.mjs mission # renders one variant
 *
 * Playwright is a transitive dep of some Docusaurus plugins on some
 * setups; if not present, install with `npm i -D playwright` and run
 * `npx playwright install chromium`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'static', 'img', 'ime');
const BASE_URL = process.env.IME_BASE_URL || 'http://localhost:3000';
const VARIANTS = ['general', 'mission'];

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
    console.error('Playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, {recursive: true});
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: {width: 1280, height: 900},
    deviceScaleFactor: 2,
  });

  try {
    for (const variant of targets) {
      const url = `${BASE_URL}/?imeVariant=${variant}&imeExport=1`;
      console.log(`→ ${variant} :: ${url}`);
      const page = await context.newPage();
      await page.goto(url, {waitUntil: 'networkidle'});

      const el = await page.waitForSelector('[aria-label$="overview"]', {timeout: 15_000});
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
