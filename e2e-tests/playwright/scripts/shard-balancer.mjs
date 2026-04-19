#!/usr/bin/env node
/**
 * Self-calibrating shard balancer for Playwright.
 *
 * Usage:  node scripts/shard-balancer.mjs <shard_index> <total_shards> [durations_json]
 * Output: space-separated list of spec files for the requested shard (stdout).
 *
 * How it works:
 *   1. Reads real test durations from a JSON file produced by a previous CI run.
 *      The file is a simple { "specs/path.spec.ts": <seconds>, ... } map.
 *   2. Uses greedy bin-packing (heaviest-first → assign to lightest shard) to
 *      distribute spec files so every shard finishes in roughly the same time.
 *   3. Files not in the durations file get a default estimate (30 s).
 *   4. If no durations file exists, falls back to Playwright's --shard=N/M
 *      by printing nothing to stdout (caller detects empty output).
 *
 * The durations file is written by scripts/extract-durations.mjs after each
 * CI run and cached via actions/cache so the next run picks it up.
 * This makes the balancer fully self-calibrating — no manual updates needed.
 */

import {existsSync, readFileSync, readdirSync} from 'fs';
import {join, relative} from 'path';

const DEFAULT_DURATION = 30; // seconds — conservative default for unknown files

// ── Discover spec files ─────────────────────────────────────────────────

function findSpecs(dir, base) {
    let results = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(findSpecs(full, base));
        } else if (entry.name.endsWith('.spec.ts') && !full.includes('/visual/')) {
            results.push(relative(base, full));
        }
    }
    return results;
}

// ── Load durations from previous run ────────────────────────────────────

function loadDurations(filePath) {
    if (!filePath || !existsSync(filePath)) return null;
    try {
        const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
        // Validate: must be a plain object with numeric values
        if (typeof raw !== 'object' || Array.isArray(raw)) return null;
        const durations = {};
        for (const [key, val] of Object.entries(raw)) {
            if (typeof val === 'number' && val > 0) durations[key] = val;
        }
        return Object.keys(durations).length > 0 ? durations : null;
    } catch {
        return null;
    }
}

// ── Greedy bin-packing ──────────────────────────────────────────────────

function balanceShards(specFiles, totalShards, durations) {
    const sorted = specFiles
        .map((f) => ({
            file: f,
            // Lookup order: exact match (new `specs/...` format written by
            // extract-durations.mjs), then the legacy prefix-less key
            // (`functional/...`) for caches written before that script was
            // fixed. Fall back to DEFAULT_DURATION when nothing matches.
            duration: durations[f] || durations[f.replace(/^specs\//, '')] || DEFAULT_DURATION,
        }))
        .sort((a, b) => b.duration - a.duration);

    const shards = Array.from({length: totalShards}, () => ({files: [], total: 0}));

    for (const item of sorted) {
        const lightest = shards.reduce((min, s) => (s.total < min.total ? s : min), shards[0]);
        lightest.files.push(item.file);
        lightest.total += item.duration;
    }

    return shards;
}

// ── Main ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node shard-balancer.mjs <shard_index> <total_shards> [durations_json]');
    process.exit(1);
}

const shardIndex = parseInt(args[0], 10);
const totalShards = parseInt(args[1], 10);
const durationsPath = args[2] || join(new URL('..', import.meta.url).pathname, '.test-durations.json');

if (shardIndex < 1 || shardIndex > totalShards) {
    console.error(`shard_index must be between 1 and ${totalShards}`);
    process.exit(1);
}

const durations = loadDurations(durationsPath);
if (!durations) {
    // No duration data — signal caller to fall back to --shard=N/M
    console.error(`No durations file found at ${durationsPath}, falling back to --shard`);
    process.exit(0); // stdout is empty → caller uses --shard fallback
}

const pwDir = new URL('..', import.meta.url).pathname;
const specFiles = findSpecs(join(pwDir, 'specs'), pwDir).sort();
const shards = balanceShards(specFiles, totalShards, durations);
const myShard = shards[shardIndex - 1];

console.log(myShard.files.join(' '));
console.error(
    `Shard ${shardIndex}/${totalShards}: ${myShard.files.length} files, ~${Math.round(myShard.total)}s estimated ` +
        `(${Object.keys(durations).length} files with real data, ${specFiles.filter((f) => !durations[f]).length} using default ${DEFAULT_DURATION}s)`,
);
