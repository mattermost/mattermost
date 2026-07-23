// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
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

// Ownership token written into the lock file, unique per acquisition. Cross-process removal/refresh
// is done atomically (via the owner's file descriptor and rename()), never with a check-then-mutate
// on the path, so a holder that stalls, gets its lock reclaimed, then resumes can never touch the
// replacement lock another worker created.
const OWNER_TOKEN = `${process.pid}-${crypto.randomUUID()}`;

// Atomically remove LOCK_PATH only when it still carries `token`. rename() has a single winner, so we
// never rm the path directly (which could delete a lock another worker recreated): we claim whatever
// is at the path, and if it is not ours we put it straight back.
async function removeLockIfOwned(token: string): Promise<void> {
    const salvage = `${LOCK_PATH}.claim.${OWNER_TOKEN}`;
    try {
        await fs.rename(LOCK_PATH, salvage);
    } catch {
        return; // Already gone / reclaimed by someone else.
    }
    if ((await fs.readFile(salvage, 'utf8').catch(() => null)) === token) {
        await fs.rm(salvage, {force: true});
    } else {
        await fs.rename(salvage, LOCK_PATH).catch(() => fs.rm(salvage, {force: true}));
    }
}

// Reclaim the lock only if its holder went stale. Uses the same atomic claim, with an mtime re-check
// so a lock refreshed in the race window is restored to its owner rather than deleted.
async function reclaimIfStale(): Promise<void> {
    const stats = await fs.stat(LOCK_PATH).catch(() => null);
    if (!stats || Date.now() - stats.mtimeMs <= STALE_LOCK_MS) {
        return;
    }

    const salvage = `${LOCK_PATH}.stale.${OWNER_TOKEN}`;
    try {
        await fs.rename(LOCK_PATH, salvage);
    } catch {
        return; // Another worker reclaimed or the holder released it first; just retry.
    }

    const salvaged = await fs.stat(salvage).catch(() => null);
    if (salvaged && Date.now() - salvaged.mtimeMs > STALE_LOCK_MS) {
        await fs.rm(salvage, {force: true});
    } else {
        // Refreshed just before we grabbed it — hand it back to its owner.
        await fs.rename(salvage, LOCK_PATH).catch(() => fs.rm(salvage, {force: true}));
    }
}

async function acquireAIBridgeLock(): Promise<() => Promise<void>> {
    let handle: Awaited<ReturnType<typeof fs.open>>;
    for (;;) {
        try {
            handle = await fs.open(LOCK_PATH, 'wx');
            await handle.writeFile(OWNER_TOKEN);
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }
            await reclaimIfStale();
            await sleep(duration.half_sec);
        }
    }

    // Refresh via the file descriptor (futimes), so the heartbeat only ever touches our own inode —
    // once our lock is renamed/removed by a reclaimer, this updates an unlinked inode and cannot keep
    // another worker's replacement lock alive.
    const heartbeat = setInterval(() => {
        const now = new Date();
        handle.utimes(now, now).catch(() => {});
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    return async () => {
        clearInterval(heartbeat);
        await handle.close().catch(() => {});
        await removeLockIfOwned(OWNER_TOKEN);
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
