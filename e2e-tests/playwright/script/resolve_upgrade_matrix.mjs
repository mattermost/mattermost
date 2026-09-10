#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Resolves the rolling-upgrade matrix for CI: last 3 minor releases + any active Extended
// Support release. Prints JSON objects with docker tags and ESR metadata, e.g.
// [{"dockerTag":"release-11.9",...}] — or `[]` when no supported from-versions remain (CI posts
// e2e-test/playwright-full/{edition}/upgrade-from-none and skips workers).
//
// Current version + last-3 come from this local checkout's version.go. Support-end dates and ESR
// status are fetched live from master, since those lapse with calendar time.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const RELEASES_MDX_URL =
    'https://raw.githubusercontent.com/mattermost/mattermost/refs/heads/master/docs/main/product-overview/mattermost-server-releases.mdx';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const VERSION_GO_PATH = path.resolve(currentDir, '../../../server/public/model/version.go');

// Named (not inline) so referencing `.test()` below is unambiguous to both eslint and Prettier.
const RELEASE_ROW_PATTERN = /^\|\s*v\d+\.\d+\s/;
const CELL_SEPARATOR_PATTERN = /(?<!\\)\|/;

function toMinor(version) {
    const [major, minor] = version.split('.');
    return `${major}.${minor}`;
}

/** Numeric major.minor ordering — string compare would sort 11.9 after 11.10. */
function compareMinor(a, b) {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return aMajor - bMajor || aMinor - bMinor;
}

/** Maps a release patch version to the registry's floating minor tag. */
function toDockerImageTag(patchVersion) {
    const [major, minor] = patchVersion.split('.');
    return `release-${major}.${minor}`;
}

/** GitHub commit-status / dashboard label for a matrix entry. */
export function upgradeMatrixContextLabel(entry) {
    return entry.isESR ? `${entry.dockerTag}-esr` : entry.dockerTag;
}

/** Reads current + last-3-minor versions from the local checkout's version.go. */
function readLocalVersions() {
    const source = fs.readFileSync(VERSION_GO_PATH, 'utf-8');
    const block = source.match(/var versions = \[\]string\{([^}]*)\}/);
    if (!block) {
        throw new Error(`Could not find "var versions = []string{...}" block in ${VERSION_GO_PATH}`);
    }
    const versions = [...block[1].matchAll(/"([\d.]+)"/g)].map((m) => m[1]);

    // Release branches list every hotfix of their own minor first ("11.9.2", "11.9.1", "11.9.0",
    // "11.8.0", ...), so collapse to unique minors before slicing. Taking the raw entries would
    // make lastThree on release-11.9 read 11.9, 11.9, 11.8 — offering the branch its own version
    // as an upgrade source and dropping a genuinely older one.
    const minors = [...new Set(versions.map(toMinor))];
    if (minors.length < 4) {
        throw new Error(`Expected at least 4 distinct minors in ${VERSION_GO_PATH}, found ${minors.length}`);
    }
    return {
        current: minors[0],
        lastThree: minors.slice(1, 4),
    };
}

/** Fetches and parses the releases table's rows into {minor, patch, supportEnds, isESR}. */
async function fetchReleaseRows() {
    const response = await fetch(RELEASES_MDX_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${RELEASES_MDX_URL}: ${response.status} ${response.statusText}`);
    }
    const mdx = await response.text();

    const rows = [];
    for (const line of mdx.split('\n')) {
        if (!RELEASE_ROW_PATTERN.test(line)) {
            continue;
        }

        // Cell separators are unescaped `|`; the first cell's own markdown link text contains
        // escaped `\|` between [Download]/[Changelog]/SBOM links, which CELL_SEPARATOR_PATTERN's
        // lookbehind skips.
        const rawCells = line.split(CELL_SEPARATOR_PATTERN);
        const cells = rawCells.map((cell) => cell.trim()).filter(Boolean);
        if (cells.length < 3) {
            continue;
        }

        const [releaseCell, , supportEndsCell] = cells;

        const minorMatch = releaseCell.match(/^v(\d+\.\d+)/);
        const patchMatch = releaseCell.match(/releases\.mattermost\.com\/(\d+\.\d+\.\d+)\//);
        const dateMatch = supportEndsCell.match(/(\d{4}-\d{2}-\d{2})/);
        if (!minorMatch || !patchMatch || !dateMatch) {
            continue;
        }

        rows.push({
            minor: minorMatch[1],
            patch: patchMatch[1],
            supportEnds: new Date(dateMatch[1]),
            isESR: supportEndsCell.includes('[EXTENDED]'),
        });
    }
    return rows;
}

export async function resolveUpgradeMatrix(now = new Date()) {
    const {current, lastThree} = readLocalVersions();
    const rows = await fetchReleaseRows();

    const active = rows.filter((row) => row.supportEnds > now);

    // Only strictly older minors are upgrade sources. The ESR clause below is otherwise unbounded:
    // cutting release-11.7 while 11.7 is the active ESR would put 11.7 in its own matrix, which is
    // a no-op upgrade rather than coverage.
    const older = active.filter((row) => compareMinor(row.minor, current) < 0);
    const matrix = older.filter((row) => lastThree.includes(row.minor) || row.isESR);

    const seenMinors = new Set();
    const entries = [];
    for (const row of matrix) {
        if (seenMinors.has(row.minor)) {
            continue;
        }
        seenMinors.add(row.minor);
        const dockerTag = toDockerImageTag(row.patch);
        entries.push({
            dockerTag,
            minor: row.minor,
            patch: row.patch,
            isESR: row.isESR,
            contextLabel: upgradeMatrixContextLabel({dockerTag, isESR: row.isESR}),
        });
    }
    return entries;
}

async function main() {
    const entries = await resolveUpgradeMatrix();
    console.log(JSON.stringify(entries));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(String(error));

        // Rethrow (not process.exit()) — an unhandled rejection still exits non-zero, which is
        // all CI/local invocations need to fail loudly.
        throw error;
    });
}
