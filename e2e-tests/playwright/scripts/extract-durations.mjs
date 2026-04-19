#!/usr/bin/env node
/**
 * Extract per-file test durations from Playwright's results.json.
 *
 * Usage:  node scripts/extract-durations.mjs [results_json] [output_json]
 *
 * Reads the merged results.json produced by `npx playwright merge-reports`,
 * sums the duration of every test in each spec file, and writes a simple
 * { "specs/path.spec.ts": <total_seconds>, ... } map.
 *
 * The output file is consumed by shard-balancer.mjs on the next CI run.
 * Cached via actions/cache so it persists across runs — zero manual upkeep.
 */

import {existsSync, readFileSync, writeFileSync} from 'fs';

const args = process.argv.slice(2);
const resultsPath = args[0] || 'results/reporter/results.json';
const outputPath = args[1] || '.test-durations.json';

if (!existsSync(resultsPath)) {
    console.error(`Results file not found: ${resultsPath}`);
    process.exit(1);
}

const results = JSON.parse(readFileSync(resultsPath, 'utf-8'));

// Walk the suite tree and collect per-file durations.
// Playwright results.json has nested suites → specs → tests → results.
const fileDurations = {};

// Normalize spec paths so they match what `scripts/shard-balancer.mjs`
// produces via `findSpecs()` — which returns paths relative to the
// playwright dir (i.e. `specs/functional/...`). Playwright's
// `spec.file` in results.json is relative to `testDir` (configured as
// `specs`), so the raw key is `functional/...` without the `specs/`
// prefix. Without this normalization the balancer's `durations[file]`
// lookup misses on every file and every file falls back to the
// 30 s default — defeating the whole point of duration-based balancing.
// Observed on run 24630407320 where the balancer distributed 14 files
// per shard by count alone and 3/8 shards timed out.
function normalizeSpecPath(file) {
    return file.startsWith('specs/') ? file : `specs/${file}`;
}

function walkSuite(suite) {
    // Each suite may have a file property, or we inherit from parent
    const suiteFile = suite.file || '';

    if (suite.specs) {
        for (const spec of suite.specs) {
            const file = spec.file || suiteFile;
            if (!file) continue;

            const key = normalizeSpecPath(file);
            for (const test of spec.tests || []) {
                for (const result of test.results || []) {
                    const durationSec = (result.duration || 0) / 1000;
                    fileDurations[key] = (fileDurations[key] || 0) + durationSec;
                }
            }
        }
    }

    // Recurse into nested suites
    for (const child of suite.suites || []) {
        // Child inherits parent's file if not overridden
        if (!child.file && suiteFile) child.file = suiteFile;
        walkSuite(child);
    }
}

for (const suite of results.suites || []) {
    walkSuite(suite);
}

// Round to nearest second for readability
const rounded = {};
for (const [file, duration] of Object.entries(fileDurations)) {
    rounded[file] = Math.round(duration);
}

// Merge with existing durations file to keep data for files not in this run
// (e.g., skipped tests). Newer values overwrite older ones.
let merged = {};
if (existsSync(outputPath)) {
    try {
        merged = JSON.parse(readFileSync(outputPath, 'utf-8'));
    } catch {
        // Corrupt file — start fresh
    }
}
Object.assign(merged, rounded);

// Sort keys for stable diffs
const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + '\n');
console.log(`Extracted durations for ${Object.keys(rounded).length} files → ${outputPath}`);
console.log(`Total files in map: ${Object.keys(sorted).length}`);
