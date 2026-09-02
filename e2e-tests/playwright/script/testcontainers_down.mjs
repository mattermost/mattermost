#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Reused containers are deliberately left running after a Playwright process exits, so there's no
// in-process teardown to call from a fresh invocation of this script — it finds and removes them
// directly via Docker, by the label every container this project starts carries.
//
// Also doubles as CI's final teardown step: with PW_TESTCONTAINERS_REUSE, the stack stays up
// across every per-spec test invocation in a job, so none of them ever run the real (non-adopted)
// teardown path that collects container logs or archives the boot-env drift history. This script
// does both before removing anything, so `ci/upload-debug-artifacts` still picks them up.

import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LABEL_FILTER = 'label=mm-playwright-testcontainers=true';
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const ENV_FILE_PATH = path.resolve(process.cwd(), '.env.testcontainers');

function run(command) {
    try {
        return execSync(command, {encoding: 'utf-8'}).trim();
    } catch {
        return '';
    }
}

// Reads the last-written PW_TESTCONTAINERS_NETWORK_NAME= line from .env.testcontainers before
// it's archived/removed, so this run's network can be removed by name instead of via a host-wide
// `docker network prune`. Entries are appended on each write, so the last match is current.
function readTestcontainersNetworkName() {
    if (!fs.existsSync(ENV_FILE_PATH)) {
        return undefined;
    }
    const matches = [...fs.readFileSync(ENV_FILE_PATH, 'utf-8').matchAll(/^PW_TESTCONTAINERS_NETWORK_NAME=(.*)$/gm)];
    return matches.at(-1)?.[1]?.trim() || undefined;
}

// Archives, then removes, .env.testcontainers — a stale copy left behind would seed the next
// fresh boot's config overrides from a container that no longer exists, wrongly convincing a
// later pw.ensure*() call that some old setting is already active.
function archiveEnvFile() {
    if (!fs.existsSync(ENV_FILE_PATH)) {
        return;
    }
    fs.mkdirSync(LOG_DIR, {recursive: true});
    fs.copyFileSync(ENV_FILE_PATH, path.join(LOG_DIR, 'testcontainers_env_history.log'));
    fs.rmSync(ENV_FILE_PATH);
}

function collectLogs(containerIds) {
    fs.mkdirSync(LOG_DIR, {recursive: true});
    for (const id of containerIds) {
        const image = run(`docker inspect -f "{{.Config.Image}}" ${id}`) || id;
        const safeName = image.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const outPath = path.join(LOG_DIR, `${safeName}-${id.slice(0, 12)}.log`);
        try {
            execSync(`docker logs "${id}" > "${outPath}" 2>&1`);
        } catch {
            // Best-effort — a container that's already gone or never logged anything shouldn't
            // block teardown.
        }
    }
}

const containerIds = run(`docker ps -aq --filter "${LABEL_FILTER}"`).split('\n').filter(Boolean);

const networkName = readTestcontainersNetworkName();
archiveEnvFile();

if (containerIds.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No Testcontainers-managed containers found (nothing to remove).');
} else {
    collectLogs(containerIds);

    // eslint-disable-next-line no-console
    console.log(`Removing ${containerIds.length} Testcontainers-managed container(s): ${containerIds.join(', ')}`);
    execSync(`docker rm -f ${containerIds.join(' ')}`, {stdio: 'inherit'});

    if (networkName) {
        // eslint-disable-next-line no-console
        console.log(`Removing Testcontainers-managed network: ${networkName}`);
        run(`docker network rm ${networkName}`);
    }
}
