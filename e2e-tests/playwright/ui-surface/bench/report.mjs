// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Build a self-contained bench/report.html (inline CSS, no external assets, light/dark) from results/*.json.

import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

import {HERE} from './lib.mjs';

const rows = JSON.parse(readFileSync(join(HERE, 'results/matrix.json'), 'utf8'));
let timing = {};
try {
    timing = JSON.parse(readFileSync(join(HERE, 'results/timing.json'), 'utf8'));
} catch {
    timing = {};
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

function cell(v) {
    const status = v.status;
    const cls = {CAUGHT: 'ok', MISSED: 'bad', 'FALSE-POSITIVE': 'warn', 'NOT-RUN': 'na'}[status] ?? 'na';
    const label = status === 'CAUGHT' && v.clean ? 'CLEAN' : status;
    return `<td class="${cls}"><span class="tag">${label}</span>${v.excerpt ? `<div class="ex">${esc(v.excerpt).slice(0, 180)}</div>` : ''}</td>`;
}

const count = (tool, status) => rows.filter((r) => r[tool].status === status).length;
const summary = ['lean', 'peter']
    .map(
        (t) =>
            `<tr><th>${t}</th><td class="ok">${count(t, 'CAUGHT')}</td><td class="bad">${count(t, 'MISSED')}</td><td class="warn">${count(t, 'FALSE-POSITIVE')}</td><td class="na">${count(t, 'NOT-RUN')}</td></tr>`,
    )
    .join('');

const matrixRows = rows
    .map(
        (r) =>
            `<tr><td>${esc(r.category)}</td><td><code>${esc(r.id)}</code><div class="ex">${esc(r.title)}</div></td><td class="lvl">${r.level}</td>${cell(r.lean)}${cell(r.peter)}</tr>`,
    )
    .join('\n');

const lean = timing.lean;
const peter = timing.peter;
const timingRows = lean
    ? `<tr><th>lean (this branch)</th><td>${lean.coldSec}s</td><td>${lean.warmSec}s</td><td>${lean.oneFileSec}s</td><td>${lean.maxRssMb} MB</td></tr>${
          peter
              ? `<tr><th>peter (surface-11)</th><td>${peter.seconds}s</td><td colspan="2">whole-program, no cache</td><td>${Math.round(peter.maxRssKb / 1024)} MB</td></tr>`
              : '<tr><th>peter (surface-11)</th><td colspan="4" class="na">run bench:peter-scan (heavy)</td></tr>'
      }`
    : '<tr><td colspan="5" class="na">no timing captured</td></tr>';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UI Surface head-to-head: lean vs Peter</title>
<style>
:root{--bg:#fff;--fg:#1b1d22;--mut:#5c6370;--line:#e3e6eb;--ok:#e7f6ec;--okf:#1a7f37;--bad:#fdecec;--badf:#c81e1e;--warn:#fff4e5;--warnf:#b45309;--na:#f1f2f4;--naf:#7a828e;--card:#f7f8fa;}
@media (prefers-color-scheme:dark){:root{--bg:#15171c;--fg:#e6e8ec;--mut:#9aa3af;--line:#2a2e37;--ok:#10291a;--okf:#4ade80;--bad:#2c1618;--badf:#f87171;--warn:#2b2110;--warnf:#fbbf24;--na:#20242c;--naf:#8b93a1;--card:#1b1e25;}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em}
.sub{color:var(--mut);margin:0 0 8px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}
th{background:var(--card);font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.ex{color:var(--mut);font-size:11.5px;margin-top:3px}
.lvl{color:var(--mut);font-size:11px;text-transform:uppercase}
.tag{display:inline-block;padding:1px 7px;border-radius:10px;font-weight:600;font-size:11px}
td.ok .tag{background:var(--ok);color:var(--okf)}td.bad .tag{background:var(--bad);color:var(--badf)}
td.warn .tag{background:var(--warn);color:var(--warnf)}td.na .tag{background:var(--na);color:var(--naf)}
td.ok,td.bad,td.warn,td.na{max-width:360px}
.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--mut);font-size:12px;margin:6px 0}
.sumtable td,.sumtable th{text-align:center}.sumtable th:first-child{text-align:left}
.foot{color:var(--mut);font-size:12px;margin-top:24px;border-top:1px solid var(--line);padding-top:12px}
.bar{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--okf) var(--p),var(--na) var(--p))}
</style></head><body>
<h1>UI Surface head-to-head: lean vs Peter</h1>
<p class="sub">Generated ${new Date().toISOString()}. lean = <code>e2e-tests/playwright/ui-surface</code> (this branch). peter = <code>test-surface</code> @ <code>praiden/feat/surface-11-master-additions</code>. Each mutation is run through both tools exactly as each is configured in its repo.</p>

<h2>Scoreboard</h2>
<table class="sumtable"><tr><th>tool</th><th>caught</th><th>missed</th><th>false-positive</th><th>not run</th></tr>${summary}</table>
<div class="legend"><span><b>CAUGHT</b> flagged a real mistake / correctly left a clean sample alone</span><span><b>MISSED</b> did not flag a real mistake</span><span><b>FALSE-POSITIVE</b> flagged a clean sample</span><span><b>NOT-RUN</b> mechanism not available here</span></div>

<h2>Mutation matrix</h2>
<table><thead><tr><th>category</th><th>mutation</th><th>level</th><th>lean</th><th>peter</th></tr></thead>
<tbody>${matrixRows}</tbody></table>

<h2>Speed &amp; memory (full webapp, median of 3)</h2>
<table><tr><th>tool</th><th>cold</th><th>warm</th><th>one-file</th><th>peak RSS</th></tr>${timingRows}</table>
<p class="sub">Peter's whole-program scan is run once (~5 min, ~3.5 GB) per its own guidance; lean rescans from scratch in seconds, so warm/one-file matter only once lean's incremental cache lands.</p>

<div class="foot">level: <b>spec</b> = Playwright spec ESLint rules; <b>webapp</b> = webapp-side check (lean scanner/ratchet, Peter webapp lint); <b>scanner</b> = program-wide mistake (Peter needs his full scan, lean uses its single-file scanner). Honest note: cells marked NOT-RUN for Peter at <code>scanner</code> level require <code>npm run bench:peter-scan</code>; Peter may legitimately win categories his program-wide analysis is built for.</div>
</body></html>
`;

writeFileSync(join(HERE, 'report.html'), html);
console.log('wrote bench/report.html');
