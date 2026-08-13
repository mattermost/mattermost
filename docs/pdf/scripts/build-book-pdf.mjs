#!/usr/bin/env node
/*
 * Concatenate a section's pages into a single book PDF.
 *
 * Strategy:
 *   1. Load the configured "spine" (an ordered list of URLs to include).
 *   2. For each URL, fetch via Puppeteer and pull out just the article
 *      content (.theme-doc-markdown).
 *   3. Inject a brand-aligned cover page at the top.
 *   4. Inject the concatenated content into a single static HTML page.
 *   5. Apply the print CSS, render to PDF.
 *
 * For Mattermost API v4, the spine is generated from the OpenAPI tags
 * — overview + examples + each tag's landing + each endpoint within.
 * For a smaller demo, the API "Overview" + "Examples" + the first
 * tag's endpoints is a reasonable target.
 *
 * Usage:
 *   node pdf/scripts/build-book-pdf.mjs --book api      # default
 *   node pdf/scripts/build-book-pdf.mjs --book api --base http://localhost:3000
 *
 * Configurable via pdf/books/<book>.json — see pdf/books/api.json.
 */

import puppeteer from 'puppeteer';
import {readFileSync, mkdirSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PDF_ROOT = resolve(HERE, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function loadSpine(book) {
  const path = resolve(PDF_ROOT, 'books', `${book}.json`);
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  return cfg;
}

function coverHtml(cfg) {
  const buildDate = new Date().toISOString().slice(0, 10);
  return `
    <section class="mm-print-cover">
      <div>
        <div class="cover-meta">${cfg.eyebrow}</div>
        <h1 class="cover-title">${cfg.title}</h1>
        <div class="cover-subtitle">${cfg.subtitle}</div>
      </div>
      <div class="cover-bottom">
        <div class="cover-version">${cfg.version} · ${buildDate}</div>
        <div class="cover-tagline">Mission in Motion</div>
      </div>
    </section>
  `;
}

async function fetchArticle(page, url, index) {
  await page.goto(url, {waitUntil: 'networkidle0', timeout: 60_000});
  await page.evaluateHandle('document.fonts.ready');
  // Pull just the article body so the book doesn't carry navbar / sidebar / footer.
  // Also extract heading metadata so the book builder can compose a ToC.
  return page.evaluate((idx) => {
    const article = document.querySelector('article') || document.querySelector('.theme-doc-markdown');
    if (!article) {
      return {html: '<!-- no article found -->', title: 'Untitled', subsections: []};
    }
    const clone = article.cloneNode(true);
    const chapterId = `mm-chapter-${idx}`;
    clone.setAttribute('id', chapterId);
    const h1 = clone.querySelector('h1');
    const title = (h1 && h1.textContent.trim()) || document.title || 'Untitled';
    // Anchor the H1 itself so the ToC entry jumps to the start of the chapter.
    if (h1 && !h1.id) h1.id = chapterId + '-title';
    const subsections = Array.from(clone.querySelectorAll('h2')).map((h, i) => {
      if (!h.id) h.id = `${chapterId}-h2-${i}`;
      return {text: h.textContent.trim().replace(/​/g, ''), id: h.id};
    });
    return {html: clone.outerHTML, title, subsections};
  }, index);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

function tocHtml(articles) {
  const items = articles.map((a, i) => {
    const sub = a.subsections.length
      ? `<ol class="toc-sub">${a.subsections
          .map((s) => `<li><a href="#${s.id}"><span class="toc-text">${escapeHtml(s.text)}</span><span class="toc-leader"></span><span class="toc-page" data-href="#${s.id}"></span></a></li>`)
          .join('')}</ol>`
      : '';
    return `<li class="toc-chapter">
      <a href="#mm-chapter-${i}">
        <span class="toc-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="toc-text">${escapeHtml(a.title)}</span>
        <span class="toc-leader"></span>
        <span class="toc-page" data-href="#mm-chapter-${i}"></span>
      </a>
      ${sub}
    </li>`;
  }).join('');
  return `
    <section class="mm-print-toc">
      <header class="toc-header">
        <div class="toc-eyebrow">Contents</div>
        <h1 class="toc-heading">Table of Contents</h1>
      </header>
      <ol class="toc-list">${items}</ol>
    </section>
  `;
}

async function main() {
  const bookName = arg('book', 'api');
  const base = arg('base', 'http://localhost:3000');
  const output = arg('out', resolve(PDF_ROOT, 'build', `mattermost-${bookName}.pdf`));

  const cfg = loadSpine(bookName);
  console.log(`[book] ${cfg.title} · ${cfg.spine.length} pages from ${base}`);

  const printCss = readFileSync(resolve(PDF_ROOT, 'styles', 'print.css'), 'utf8');
  mkdirSync(dirname(resolve(output)), {recursive: true});

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });

  try {
    const fetcher = await browser.newPage();
    fetcher.on('pageerror', (e) => console.error(`[book:browser-error] ${e.message}`));

    const articles = [];
    for (let i = 0; i < cfg.spine.length; i++) {
      const path = cfg.spine[i];
      const url = base + path;
      console.log(`[book]   ${path}`);
      articles.push(await fetchArticle(fetcher, url, i));
    }

    // Compose the book document. We let Docusaurus's built CSS load too
    // (so MDX components keep their layout); the print CSS overrides
    // what's needed for paper.
    const stylesUrl = `${base}/assets/css/styles.css`;
    const htmlPath = resolve(PDF_ROOT, 'build', `${bookName}-book.html`);
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${cfg.title}</title>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
  <style id="print-stylesheet">${printCss}</style>
</head>
<body>
  ${coverHtml(cfg)}
  ${tocHtml(articles)}
  ${articles.map((a) => a.html).join('\n<hr class="mm-page-break"/>\n')}
</body>
</html>`;
    const fs = await import('node:fs/promises');
    await fs.writeFile(htmlPath, html);

    const printer = await browser.newPage();
    printer.on('console', (m) => {
      if (m.type() === 'error') console.error(`[book:browser-error] ${m.text()}`);
    });
    await printer.goto(`file://${htmlPath}`, {waitUntil: 'networkidle0'});
    await printer.emulateMediaType('print');
    await printer.evaluateHandle('document.fonts.ready');

    // Rewrite the OpenAPI dev-server URL prefix to a generic example
    // so the printed reference doesn't carry "http://localhost:8065"
    // through to readers. This applies only to print captures; the
    // live dev site keeps the localhost default for "Send API Request"
    // testing convenience.
    await printer.evaluate(() => {
      const REPLACEMENT = 'https://your-mattermost-server.com';
      const PATTERN = /https?:\/\/localhost:\d+/g;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue && PATTERN.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(PATTERN, REPLACEMENT);
        }
      }
    });

    console.log(`[book] rendering → ${output}`);
    await printer.pdf({
      path: resolve(output),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });

    const {size} = statSync(resolve(output));
    const pages = Math.ceil(size / 25_000);    // very rough estimate — replace with PDF probe later
    console.log(`[book] done — ${(size / 1024).toFixed(1)} KB (~${pages} pages estimated)`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[book] fatal:', e);
  process.exit(1);
});
