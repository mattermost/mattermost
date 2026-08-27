#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Resolves the rolling-upgrade matrix for CI: last 3 minor releases + any active Extended
// Support release. Prints Docker image tags as JSON, e.g.
// ["release-11.9","release-11.8","release-11.7","release-10.11"].
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

/** Maps a release patch version to the registry's floating minor tag. */
function toDockerImageTag(patchVersion) {
    const [major, minor] = patchVersion.split('.');
    return `release-${major}.${minor}`;
}

/** Reads current + last-3-minor versions from the local checkout's version.go. */
function readLocalVersions() {
    const source = fs.readFileSync(VERSION_GO_PATH, 'utf-8');
    const block = source.match(/var versions = \[\]string\{([^}]*)\}/);
    if (!block) {
        throw new Error(`Could not find "var versions = []string{...}" block in ${VERSION_GO_PATH}`);
    }
    const versions = [...block[1].matchAll(/"([\d.]+)"/g)].map((m) => m[1]);
    if (versions.length < 4) {
        throw new Error(`Expected at least 4 versions in ${VERSION_GO_PATH}, found ${versions.length}`);
    }
    return {
        current: toMinor(versions[0]),
        lastThree: versions.slice(1, 4).map(toMinor),
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
    const {lastThree} = readLocalVersions();
    const rows = await fetchReleaseRows();

    const active = rows.filter((row) => row.supportEnds > now);
    const matrix = active.filter((row) => lastThree.includes(row.minor) || row.isESR);

    const seenMinors = new Set();
    const imageTags = [];
    for (const row of matrix) {
        if (seenMinors.has(row.minor)) {
            continue;
        }
        seenMinors.add(row.minor);
        imageTags.push(toDockerImageTag(row.patch));
    }
    return imageTags;
}

async function main() {
    const imageTags = await resolveUpgradeMatrix();
    if (imageTags.length === 0) {
        throw new Error('Resolved rolling-upgrade matrix is empty — refusing to silently skip upgrade coverage.');
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(imageTags));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(String(error));

        // Rethrow (not process.exit()) — an unhandled rejection still exits non-zero, which is
        // all CI/local invocations need to fail loudly.
        throw error;
    });
}
