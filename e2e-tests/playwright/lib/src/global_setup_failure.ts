// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Hands a fatal globalSetup() error to the worker process that runs the actual tests — they're
 * separate OS processes (globalSetup runs in the main runner process), so an in-memory flag set
 * in one is invisible to the other; a file both read via the same cwd is the only channel.
 *
 * globalSetup() records here instead of throwing, so Playwright still attempts the spec file.
 * The resetConfigAndRoles auto fixture checks this first and fails the test immediately: a loud,
 * visible "failed" test beats letting globalSetup abort before any test runs — that leaves
 * Playwright's own report with zero test cases for the file, which CI dispatch cannot tell apart
 * from a legitimately-filtered-out spec and silently counts as "skipped" instead of "failed".
 */
const MARKER_PATH = path.resolve(process.cwd(), '.global-setup-failure.json');

/** Records `message` so every test in this worker's next spec invocation fails loudly with it. */
export function recordGlobalSetupFailure(message: string): void {
    fs.writeFileSync(MARKER_PATH, JSON.stringify({message}), 'utf-8');
}

/** Clears a failure a previous invocation on this same worker left behind. */
export function clearGlobalSetupFailure(): void {
    if (fs.existsSync(MARKER_PATH)) {
        fs.rmSync(MARKER_PATH);
    }
}

/** The recorded failure message, or null when globalSetup() last completed without one. */
export function readGlobalSetupFailure(): string | null {
    if (!fs.existsSync(MARKER_PATH)) {
        return null;
    }

    try {
        const {message} = JSON.parse(fs.readFileSync(MARKER_PATH, 'utf-8')) as {message: string};
        return message;
    } catch {
        return null;
    }
}
