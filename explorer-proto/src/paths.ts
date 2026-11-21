// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

// Resolved from the working directory because the same modules load both as ESM (node CLI)
// and as CJS (Playwright's transform), so neither import.meta nor __dirname works in both.
function findProtoDir(): string {
    let dir = process.cwd();
    for (;;) {
        for (const candidate of [dir, path.join(dir, 'explorer-proto')]) {
            if (
                fs.existsSync(path.join(candidate, 'scenarios.json')) &&
                fs.existsSync(path.join(candidate, 'src', 'paths.ts'))
            ) {
                return candidate;
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error('Run from the repository root or inside explorer-proto/.');
        }
        dir = parent;
    }
}

export const PROTO_DIR = findProtoDir();
export const REPO_DIR = path.dirname(PROTO_DIR);
export const SRC_DIR = path.join(PROTO_DIR, 'src');
export const SCENARIOS_PATH = path.join(PROTO_DIR, 'scenarios.json');
export const COVERAGE_PATH = path.join(PROTO_DIR, 'coverage.md');
export const MANIFEST_PATH = path.join(PROTO_DIR, 'infra', '.run', 'seed-manifest.json');
export const GENERATED_DIR = path.join(PROTO_DIR, 'generated');
export const REPORTS_DIR = path.join(GENERATED_DIR, 'reports');
export const RESULTS_DIR = path.join(GENERATED_DIR, 'test-results');
export const PLAYWRIGHT_DIR = path.join(REPO_DIR, 'e2e-tests', 'playwright');
export const PLAYWRIGHT_SPECS_DIR = path.join(PLAYWRIGHT_DIR, 'specs');
export const CONFIG_PATH = path.join(PROTO_DIR, 'playwright.config.ts');

export const SCRATCH_DIR = path.join(PROTO_DIR, 'infra', '.run');
export const SESSIONS_DIR = path.join(PROTO_DIR, 'sessions');

/** Charter session selected with `--session=<name>` (CLI) or PILOT_SESSION; '' for the default pilot. */
export function sessionName(): string {
    const name = process.env.PILOT_SESSION ?? '';
    if (name && (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(path.join(SESSIONS_DIR, name, 'charter.json')))) {
        throw new Error(`Unknown session "${name}": expected explorer-proto/sessions/<name>/charter.json.`);
    }
    return name;
}

/** Journey selected with `--journey=<name>` (CLI) or PILOT_JOURNEY; '' when not a journey command. */
export function journeyName(): string {
    const name = process.env.PILOT_JOURNEY ?? '';
    if (name && (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(path.join(SESSIONS_DIR, name, 'charter.json')))) {
        throw new Error(`Unknown journey "${name}": expected explorer-proto/sessions/<name>/charter.json.`);
    }
    return name;
}

export function sessionGeneratedDir(name: string): string {
    return path.join(SESSIONS_DIR, name, 'generated');
}

export function outDir(): string {
    const scoped = sessionName() || journeyName();
    return path.resolve(process.env.EXPLORER_OUT_DIR || (scoped ? sessionGeneratedDir(scoped) : GENERATED_DIR));
}

/** Playwright JSON reports and test results; git-ignored in both locations. */
export function reportsDir(): string {
    const scoped = sessionName() || journeyName();
    return scoped ? path.join(sessionGeneratedDir(scoped), 'reports') : REPORTS_DIR;
}

export function resultsDir(): string {
    const scoped = sessionName() || journeyName();
    return scoped ? path.join(sessionGeneratedDir(scoped), 'test-results') : RESULTS_DIR;
}
