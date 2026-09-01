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
//
// The lock is intentionally minimal: acquisition is a single atomic create (open with O_EXCL), and the
// lock is only ever removed by the worker that created it, on release. There is deliberately no
// stale-reclamation / hand-off path — reclaiming another worker's lock cannot be made race-free with
// filesystem primitives (it invites two workers into the critical section), so instead a lock is only
// released by its owner. Playwright runs fixture teardown even on test timeout/failure, so a held lock
// is released in every normal path; a genuinely leaked lock (hard worker crash) surfaces as a bounded
// acquire timeout on the other AI tests rather than as silent concurrent mock access.
const LOCK_PATH = path.join(os.tmpdir(), 'mm-e2e-ai-bridge-mock.lock');

// Poll interval while waiting for a held lock, and the extra budget granted for that wait so it does
// not eat into the per-test timeout.
const RETRY_INTERVAL_MS = duration.half_sec;
const LOCK_ACQUIRE_BUDGET_MS = duration.four_min;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAIBridgeLock(): Promise<() => Promise<void>> {
    let handle: Awaited<ReturnType<typeof fs.open>>;
    for (;;) {
        try {
            handle = await fs.open(LOCK_PATH, 'wx');
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }
            await sleep(RETRY_INTERVAL_MS);
        }
    }

    let released = false;
    return async () => {
        if (released) {
            return;
        }
        released = true;
        await handle.close().catch(() => {});
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
