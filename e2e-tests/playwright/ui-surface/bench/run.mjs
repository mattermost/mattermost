// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Head-to-head harness. `npm run bench` runs the lean tool fully and, when Peter's worktree is reachable, runs Peter's
// ESLint spec/webapp rules too (fast). Peter's program-wide scanner is heavy (~5 min, ~3.5 GB), so its results are
// read from bench/results/peter-scan.json when present (produced by `npm run bench:peter-scan`), and otherwise shown
// as "not run". Nothing here mutates committed files.

import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

import {
    HERE,
    LEAN_ROOT,
    PETER_DIR,
    PW_ROOT,
    leanCheck,
    lintSpecs,
    lintWebapp,
    loadJson,
    median,
    timed,
} from './lib.mjs';
import {mutations} from './mutations.mjs';

const RESULTS = join(HERE, 'results');
mkdirSync(RESULTS, {recursive: true});

const specMutations = mutations.filter((m) => m.level === 'spec');
const webappMutations = mutations.filter((m) => m.level !== 'spec');
const peterAvailable = existsSync(join(PETER_DIR, 'node_modules'));

/** Turn a list of {rule/ruleId, message} into a verdict for one sample. */
function verdict(sample, hits) {
    const caught = hits.length > 0;
    const excerpt = hits[0]?.message ?? '';
    if (sample.expectCaught === false) {
        return {status: caught ? 'FALSE-POSITIVE' : 'CAUGHT' /* correctly clean */, clean: true, excerpt};
    }
    return {status: caught ? 'CAUGHT' : 'MISSED', clean: false, excerpt};
}

async function run() {
    console.log(`lean = ${LEAN_ROOT}`);
    console.log(`peter = ${PETER_DIR} (${peterAvailable ? 'available' : 'NOT available'})`);

    // ---- lean: spec rules via its real repo config, webapp/scanner via its check ----
    console.log('\nRunning lean spec rules...');
    const leanSpec = await lintSpecs(PW_ROOT, 'ui-surface/', specMutations);
    console.log('Running lean webapp/scanner checks...');
    const leanWebapp = new Map();
    for (const m of webappMutations) {
        const diags = await leanCheck(m);
        leanWebapp.set(m.id, {messages: diags.map((d) => ({ruleId: d.rule, message: d.message}))});
    }

    // ---- peter: spec + webapp lint via his real config (fast); scanner from cache ----
    let peterSpec = new Map();
    let peterWebappLint = new Map();
    const peterScan = loadJson(join(RESULTS, 'peter-scan.json'));
    if (peterAvailable) {
        console.log('Running peter spec rules...');
        peterSpec = await lintSpecs(PETER_DIR, 'test-surface/', specMutations);
        console.log('Running peter webapp lint rules...');
        peterWebappLint = await lintWebapp(
            join(PETER_DIR, '..', '..', 'webapp', 'channels'),
            'test-surface/',
            webappMutations,
        );
    }

    const rows = [];
    for (const m of mutations) {
        const leanHits = (m.level === 'spec' ? leanSpec.get(m.id) : leanWebapp.get(m.id))?.messages ?? [];
        const lean = verdict(m, leanHits);

        let peter;
        if (m.level === 'spec') {
            const specHits = peterSpec.get(m.id)?.messages ?? [];
            if (!peterAvailable) {
                peter = {status: 'NOT-RUN', excerpt: ''};
            } else if (m.id === 'clean-spec' && specHits.length) {
                // Peter bans literal getByTestId (page objects only): stricter than lean, not a defect on a clean control.
                peter = {
                    status: 'N/A',
                    excerpt:
                        "Peter bans literal getByTestId (page objects only) — stronger than lean; clean under lean's contract",
                };
            } else {
                peter = verdict(m, specHits);
            }
        } else {
            // webapp/scanner: combine Peter's fast webapp lint with his cached full-scan diagnostics.
            const lintHits = peterWebappLint.get(m.id)?.messages ?? [];
            const scanHits = peterScan?.caught?.[m.id] ? [{message: peterScan.caught[m.id]}] : [];
            const note = peterScan?.notes?.[m.id];
            if (m.id === 'drift-disagree') {
                peter = {status: 'N/A', excerpt: 'Peter uses data-testid only; no data-surface to disagree with'};
            } else if (note) {
                peter = {status: 'N/A', excerpt: note};
            } else if (!peterAvailable && !peterScan) {
                peter = {status: 'NOT-RUN', excerpt: ''};
            } else if (lintHits.length || scanHits.length) {
                peter = verdict(m, [...lintHits, ...scanHits]);
            } else if (
                (m.level === 'scanner' || ['dup-sibling-testid', 'role-native-div'].includes(m.id)) &&
                !peterScan
            ) {
                peter = {status: 'NOT-RUN', excerpt: 'needs bench:peter-scan (full program scan)'};
            } else {
                peter = verdict(m, []);
            }
        }
        rows.push({
            id: m.id,
            category: m.category,
            level: m.level,
            title: m.title,
            expectCaught: m.expectCaught,
            lean,
            peter,
        });
    }

    writeFileSync(join(RESULTS, 'matrix.json'), JSON.stringify(rows, null, 2) + '\n');

    // ---- timing / RSS on the full webapp (lean), median of 3 ----
    console.log('\nTiming lean on the full webapp (cold/warm/one-file, 3x median)...');
    const timing = measureLeanTiming();
    if (peterScan?.timing) {
        timing.peter = peterScan.timing;
    }
    writeFileSync(join(RESULTS, 'timing.json'), JSON.stringify(timing, null, 2) + '\n');

    summarize(rows, timing);
    execFileSync('node', [join(HERE, 'report.mjs')], {cwd: HERE, stdio: 'inherit'});
}

function tryExec(bin, args) {
    try {
        execFileSync('node', [bin, ...args], {cwd: PW_ROOT, stdio: 'ignore'});
        return true;
    } catch {
        return false;
    }
}

function measureLeanTiming() {
    const bin = join(LEAN_ROOT, 'bin/ui-surface.mjs');
    const cacheDir = join(PW_ROOT, '.ui-surface-cache');
    const hasCache = tryExec(bin, ['check', '--incremental', '--help']) || existsSync(cacheDir);
    const runs = {cold: [], warm: [], oneFile: [], rss: []};
    for (let i = 0; i < 3; i++) {
        execFileSync('rm', ['-rf', cacheDir], {stdio: 'ignore'});
        const cold = timed('node', [bin, 'check', '--incremental'], PW_ROOT);
        const warm = timed('node', [bin, 'check', '--incremental'], PW_ROOT);

        // one-file-changed: invalidate a single cached file if the tool supports it; else repeat warm.
        tryExec(bin, ['cache-bust', '1']);
        const one = timed('node', [bin, 'check', '--incremental'], PW_ROOT);
        runs.cold.push(cold.seconds);
        runs.warm.push(warm.seconds);
        runs.oneFile.push(one.seconds);
        runs.rss.push(cold.maxRssKb);
    }
    return {
        lean: {
            incremental: hasCache,
            coldSec: median(runs.cold),
            warmSec: median(runs.warm),
            oneFileSec: median(runs.oneFile),
            maxRssMb: Math.round(median(runs.rss) / 1024),
            samples: runs,
        },
    };
}

function summarize(rows, timing) {
    const count = (tool, status) => rows.filter((r) => r[tool].status === status).length;
    console.log('\n==== SUMMARY ====');
    for (const tool of ['lean', 'peter']) {
        console.log(
            `${tool.padEnd(6)} caught=${count(tool, 'CAUGHT')} missed=${count(tool, 'MISSED')} false-positive=${count(tool, 'FALSE-POSITIVE')} not-run=${count(tool, 'NOT-RUN')}`,
        );
    }
    if (timing.lean) {
        console.log(
            `lean timing: cold=${timing.lean.coldSec}s warm=${timing.lean.warmSec}s one-file=${timing.lean.oneFileSec}s rss=${timing.lean.maxRssMb}MB`,
        );
    }
    if (timing.peter) {
        console.log(
            `peter timing: full=${timing.peter.seconds}s rss=${Math.round(timing.peter.maxRssKb / 1024)}MB (run once)`,
        );
    }
    console.log(`\nWrote ${join('results', 'matrix.json')}, ${join('results', 'timing.json')}, report.html`);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
