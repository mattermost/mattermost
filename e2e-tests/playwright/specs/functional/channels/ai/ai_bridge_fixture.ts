// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {
    PlaywrightTestArgs,
    PlaywrightTestOptions,
    PlaywrightWorkerArgs,
    PlaywrightWorkerOptions,
    TestType,
} from '@playwright/test';

import type {ExtendedFixtures} from '@mattermost/playwright-lib';
import {test as base} from '@mattermost/playwright-lib';

export {expect} from '@mattermost/playwright-lib';

// The server-side AI bridge mock (server/channels/app/e2e_agents_bridge.go) is a single
// process-global resource: configuring it replaces all queued completions and clears recorded
// requests, and completions are consumed from one FIFO queue keyed only by operation. Tests that
// drive it therefore cannot run concurrently against the same server without one test wiping or
// consuming another's mock state. Playwright's internal parallelism (PW_WORKERS > 1 in CI) runs
// these specs on separate worker processes that all share the one E2E server, so we serialize them
// with a cross-process file lock held for each test's full duration.

const LOCK_PATH = path.join(os.tmpdir(), 'mm-e2e-ai-bridge-mock.lock');

// The lock holder refreshes the file's mtime on this interval while the test runs.
const HEARTBEAT_MS = 5_000;

// Break a lock whose mtime is older than this, so a crashed worker can never deadlock the run. It
// is far above the heartbeat interval, so a live holder is never reclaimed mid-test.
const STALE_LOCK_MS = 30_000;

const POLL_INTERVAL_MS = 100;

// Extra budget granted while a test blocks on the shared lock, so serialized AI bridge tests are not
// tripped by the per-test timeout while waiting their turn. Once the lock is held, the test body is
// given back its original timeout budget.
const LOCK_ACQUIRE_BUDGET_MS = 240_000;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAIBridgeLock(): Promise<() => Promise<void>> {
    for (;;) {
        try {
            const handle = await fs.open(LOCK_PATH, 'wx');
            await handle.writeFile(String(process.pid));
            await handle.close();
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }

            // Reclaim a stale lock left behind by a crashed worker.
            try {
                const stats = await fs.stat(LOCK_PATH);
                if (Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
                    await fs.rm(LOCK_PATH, {force: true});
                    continue;
                }
            } catch {
                // The lock was released between our open and stat; just retry.
            }

            await sleep(POLL_INTERVAL_MS + Math.floor(Math.random() * POLL_INTERVAL_MS));
        }
    }

    // Keep the lock fresh while held so long-running (or lock-contended) tests are not mistaken for
    // crashed holders. Unref so the heartbeat never keeps the worker process alive on its own.
    const heartbeat = setInterval(() => {
        const now = new Date();
        fs.utimes(LOCK_PATH, now, now).catch(() => {});
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    return async () => {
        clearInterval(heartbeat);
        await fs.rm(LOCK_PATH, {force: true});
    };
}

type AIBridgeFixtures = {aiBridgeMockLock: void};

export const test: TestType<
    PlaywrightTestArgs & PlaywrightTestOptions & ExtendedFixtures & AIBridgeFixtures,
    PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = base.extend<AIBridgeFixtures>({
    aiBridgeMockLock: [
        async ({}, use, testInfo) => {
            const originalTimeout = testInfo.timeout;

            // Grant extra time up front so blocking on the shared lock cannot trip the per-test
            // timeout mid-acquire (the timeout must be raised before the wait, not after).
            const waitStart = Date.now();
            testInfo.setTimeout(originalTimeout + LOCK_ACQUIRE_BUDGET_MS);
            const release = await acquireAIBridgeLock();

            // Give the test body its original budget measured from the moment the lock is held.
            testInfo.setTimeout(originalTimeout + (Date.now() - waitStart));

            try {
                await use();
            } finally {
                await release();
            }
        },
        {auto: true},
    ],
});
