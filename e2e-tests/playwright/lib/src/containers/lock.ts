// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {logTestcontainers} from './log';

import {duration, wait} from '@/util';

const LOCK_PATH = path.resolve(process.cwd(), '.testcontainers.lock');
const WAIT_TIMEOUT = duration.two_min;
const STALE_AFTER = duration.two_min;
const HEARTBEAT_EVERY = 15 * duration.one_sec;

type LockOwner = {pid: number; label: string; at: number};

// How many times this process has taken the lock, so a nested call doesn't wait on itself.
let depth = 0;

function readOwner(): LockOwner | undefined {
    try {
        return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8')) as LockOwner;
    } catch {
        return undefined;
    }
}

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}

function tryAcquire(label: string): boolean {
    try {
        fs.writeFileSync(LOCK_PATH, JSON.stringify({pid: process.pid, label, at: Date.now()}), {flag: 'wx'});
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    }

    // Held by a process that is gone, or one that stopped refreshing it (hung): take it over.
    const owner = readOwner();
    if (!owner || !isAlive(owner.pid) || Date.now() - owner.at > STALE_AFTER) {
        logTestcontainers(`removing stale stack lock (${owner ? `pid ${owner.pid}, ${owner.label}` : 'unreadable'}).`);
        fs.rmSync(LOCK_PATH, {force: true});
        return tryAcquire(label);
    }
    return false;
}

/**
 * Runs `fn` while holding a lock shared by every test process in this directory. Starting the stack and
 * restarting the server must not overlap: two concurrent starts fight for the fixed server port, and a second
 * start wipes the data directory the first one is using. A process that waits finds the stack the first one
 * brought up and reuses it.
 */
export async function withStackLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (depth > 0) {
        return fn();
    }

    const deadline = Date.now() + WAIT_TIMEOUT;
    let lastLog = Date.now();
    while (!tryAcquire(label)) {
        if (Date.now() > deadline) {
            const owner = readOwner();
            throw new Error(
                `Timed out waiting for another test process to finish ${owner?.label ?? 'using the stack'} ` +
                    `(pid ${owner?.pid ?? 'unknown'}). Remove ${LOCK_PATH} if that process is gone.`,
            );
        }
        if (Date.now() - lastLog > duration.half_min) {
            lastLog = Date.now();
            const owner = readOwner();
            logTestcontainers(`waiting for pid ${owner?.pid ?? 'unknown'} to ${owner?.label ?? 'finish'}...`);
        }

        await wait(duration.half_sec);
    }

    depth++;
    // Keeps a long start from looking stale to a waiting process.
    const heartbeat = setInterval(() => {
        if (readOwner()?.pid === process.pid) {
            fs.writeFileSync(LOCK_PATH, JSON.stringify({pid: process.pid, label, at: Date.now()}));
        }
    }, HEARTBEAT_EVERY);
    heartbeat.unref();
    // An interrupted process exits without reaching the finally below.
    const releaseOnExit = () => {
        if (readOwner()?.pid === process.pid) {
            fs.rmSync(LOCK_PATH, {force: true});
        }
    };
    process.on('exit', releaseOnExit);
    try {
        return await fn();
    } finally {
        process.off('exit', releaseOnExit);
        clearInterval(heartbeat);
        depth--;
        if (readOwner()?.pid === process.pid) {
            fs.rmSync(LOCK_PATH, {force: true});
        }
    }
}
