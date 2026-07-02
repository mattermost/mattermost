# Phase 2 — PDF pipeline

Builds brand-aligned PDF books from the docs site using headless Chromium + a print-only stylesheet.

## What's here

```
pdf/
├── books/                    # Spine config: ordered list of URLs per book
│   └── api.json
├── scripts/
│   ├── build-page-pdf.mjs    # Capture a single page → PDF (the on-demand primitive)
│   └── build-book-pdf.mjs    # Concatenate a section's pages → branded book PDF
├── styles/
│   └── print.css             # Brand-aligned print stylesheet (cover, headers, page numbers)
├── build/                    # Output (gitignored)
└── package.json              # Puppeteer
```

## Pipeline

```
docs site (npm start | npm run serve)
        │
        │ HTTP fetches per spine entry
        ▼
build-book-pdf.mjs
        │
        ├── fetches each <article> via Puppeteer page navigation
        ├── prepends a brand-aligned cover (denim + marigold + Mission in Motion)
        ├── composes static HTML, includes Google Fonts + the docs site's bundled CSS
        ├── overrides everything for paper via styles/print.css (only thing the print pass cares about)
        ▼
Puppeteer page.pdf({ format: 'A4', preferCSSPageSize: true })
        │
        ▼
build/mattermost-api.pdf
```

The print stylesheet does:
- `@page` rules for A4 size, margins, and running headers/footers
- `string-set: chapter content()` on h1 → fed into `@top-right` for chapter names
- `counter(page) " / " counter(pages)` in `@bottom-right` for page numbers
- Hides every site-chrome element (navbar, sidebar, footer, breadcrumbs, edit-this-page, OpenAPI right panel)
- Brand-aligned typography (Archivo Black headlines, Inter body, JetBrains Mono code)
- Page-break controls (`page-break-before: always` on h1, `page-break-inside: avoid` on figures/code/tables)
- Print-mode treatments for every branded MDX component (Hero flattens, Callouts get a thin denim left bar, StatStrip becomes a 4-up grid, CardGrid becomes a list)

## Usage

### Single-page (on-demand) PDF

```bash
# Pre-req: docs site is running on port 3000 (npm start in docs-site/)
node pdf/scripts/build-page-pdf.mjs http://localhost:3000/api pdf/build/api-overview.pdf
```

Suitable as the unit primitive for the eventual "Download PDF" button on every page (CF Worker calls this against the production URL).

### Multi-page book

```bash
node pdf/scripts/build-book-pdf.mjs --book api
# → pdf/build/mattermost-api.pdf
```

Spine controlled by `pdf/books/api.json` — add/remove URL paths to change what's in the book. Future work auto-generates the spine from the OpenAPI tag list.

## Current state

| Capability | Status |
| --- | --- |
| Single-page PDF capture | ✓ Working |
| Multi-page book with cover | ✓ Working |
| Brand-aligned cover (denim + marigold + Mission in Motion + version + date) | ✓ Working |
| Running header (chapter name on right) | ✓ Working |
| Running footer (page X / N) | ✓ Working |
| Page-break-before on each chapter (h1) | ✓ Working |
| Branded typography (Archivo Black headlines) | ✓ Working |
| Branded MDX components in print mode | ✓ Working |

| Coming in v1.1 / future | |
| --- | --- |
| Auto-generated TOC with page numbers | Needs Paged.js (target-counter) — see §below |
| Cross-reference page numbers ("see chapter X on page N") | Needs Paged.js |
| Watermarked customer PDFs (per-buyer "Provided to …") | CF Worker injecting watermark via page.evaluate before page.pdf |
| Auto-generated index | Needs Paged.js + index plugin |
| All sections, all versions (per PLAN.md §6.1) | Needs spine generators per OpenAPI / per RST tree |

## Paged.js — when to add

Puppeteer's native `page.pdf()` covers the basic book layout (cover, headers, footers, page breaks) using just `@page` rules. We use that today.

Paged.js adds:
- TOC generation via `target-counter()` (the printed page number a heading lands on)
- "Continued on page N" bridges
- Automatic figure / table cross-references
- Better break-balancing across columns

Add Paged.js when we hit a real need for any of those — likely Phase 5 (main docs migration, where the admin guide is 100+ pages and a good TOC matters more). For now, the cover + chapter breaks + page numbers are sufficient.

To add: load `pagedjs` from npm or CDN, mount it via `Paged.Previewer().preview(content, stylesheets, container)` before calling `page.pdf`.

## On-demand Worker (deferred)

The on-demand per-page "Download PDF" button (PLAN.md §6.2) is the same `build-page-pdf.mjs` primitive, hosted on a Cloudflare Worker:

```
User clicks "Download PDF" on /docs/11.0/admin/saml-config
                ▼
CF Worker /api/pdf?url=…
                ▼
Browser Rendering API loads the URL, applies print.css, returns PDF stream
                ▼
Worker streams PDF back with Content-Disposition: attachment
```

This is straightforward to add once production is up (Browser Rendering API needs a domain). Defer to Phase 6 (cut first release branch) or later.

## Costs

Local: free. Headless Chromium runs on your machine.

Production (CF Browser Rendering API): ~$0.001–0.005 per render. At 1000 PDFs/day (per PLAN.md §6.2), ~$50–150/mo.
