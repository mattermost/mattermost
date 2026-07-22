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
import {duration, test as base} from '@mattermost/playwright-lib';

export {expect} from '@mattermost/playwright-lib';

// The server-side AI bridge mock is process-global: every test resets it and consumes from one shared
// FIFO completion queue, so AI bridge tests running concurrently (PW_WORKERS > 1) clobber each other.
// All workers share one machine, so serialize them with a cross-process file lock held per test.
const LOCK_PATH = path.join(os.tmpdir(), 'mm-e2e-ai-bridge-mock.lock');

// The holder refreshes the lock's mtime every heartbeat; a lock older than the stale timeout is
// assumed abandoned by a crashed worker and reclaimed. Heartbeat << stale so a live holder is safe.
const HEARTBEAT_MS = duration.four_sec;
const STALE_LOCK_MS = duration.half_min;

// Extra budget so blocking on the lock cannot trip the per-test timeout; reset once the lock is held.
const LOCK_ACQUIRE_BUDGET_MS = duration.four_min;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAIBridgeLock(): Promise<() => Promise<void>> {
    for (;;) {
        try {
            await (await fs.open(LOCK_PATH, 'wx')).close();
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }

            // Reclaim the lock only if its holder went stale; otherwise wait and retry.
            const stats = await fs.stat(LOCK_PATH).catch(() => null);
            if (stats && Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
                await fs.rm(LOCK_PATH, {force: true});
                continue;
            }
            await sleep(duration.half_sec);
        }
    }

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

            // Raise the timeout before waiting, then hand the test its original budget once it holds
            // the lock, so time spent queued does not count against the test.
            const waitStart = Date.now();
            testInfo.setTimeout(originalTimeout + LOCK_ACQUIRE_BUDGET_MS);
            const release = await acquireAIBridgeLock();
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
