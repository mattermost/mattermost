#!/usr/bin/env node
/*
 * Capture a single docs page to PDF, applying the brand-aligned print
 * stylesheet. Used both for on-demand single-page PDF (the per-page
 * "Download PDF" button) and as the unit primitive that the book
 * builder concatenates.
 *
 * Usage:
 *   node pdf/scripts/build-page-pdf.mjs <url> <output.pdf>
 *   node pdf/scripts/build-page-pdf.mjs http://localhost:3000/api pdf/build/api-overview.pdf
 *
 * Pre-req: the docs site is built (npm run build) and being served
 * either by `npm run serve` or some other static server. Pass the URL
 * the page is reachable at.
 */

import puppeteer from 'puppeteer';
import {readFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

async function main() {
  const [url, output] = process.argv.slice(2);
  if (!url || !output) {
    console.error('usage: build-page-pdf.mjs <url> <output.pdf>');
    process.exit(2);
  }

  const printCss = readFileSync(new URL('../styles/print.css', import.meta.url), 'utf8');
  mkdirSync(dirname(resolve(output)), {recursive: true});

  console.log(`[pdf] launching headless Chromium…`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    page.on('console', (m) => console.log(`[pdf:browser] ${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => console.error(`[pdf:browser-error] ${e.message}`));

    console.log(`[pdf] loading ${url}`);
    await page.goto(url, {waitUntil: 'networkidle0', timeout: 60_000});

    // Apply the print stylesheet (so it lays out for paper while still
    // running with media:screen — works around quirks where some
    // Docusaurus chrome only renders for screen).
    await page.addStyleTag({content: printCss});
    await page.emulateMediaType('print');

    // Give web fonts time to settle so headlines don't fall back.
    await page.evaluateHandle('document.fonts.ready');

    console.log(`[pdf] rendering PDF → ${output}`);
    await page.pdf({
      path: resolve(output),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {top: '22mm', right: '18mm', bottom: '24mm', left: '18mm'},
      displayHeaderFooter: false,           // headers/footers come from @page in print.css
    });

    const fs = await import('node:fs/promises');
    const {size} = await fs.stat(resolve(output));
    console.log(`[pdf] done — ${(size / 1024).toFixed(1)} KB`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[pdf] fatal:', e);
  process.exit(1);
});
