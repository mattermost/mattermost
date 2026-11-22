// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the preflight checks the presence of MM_LICENSE by name and reads locations from the environment */

// `pilot.mjs doctor`: a preflight for a headless run. Prints PASS, FAIL or SKIP per item; the value of MM_LICENSE and
// the port number are never printed. Most items need no Docker.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {EXIT, PROTO_DIR, readJson, REPO_ROOT} from '../common.mjs';
import {databasePin, imagePin, targetFile} from '../stages/stage0_target.mjs';

const PLAYWRIGHT_PKG = path.join(
    REPO_ROOT,
    'e2e-tests',
    'playwright',
    'node_modules',
    '@playwright',
    'test',
    'package.json',
);

function portBusy(port) {
    return new Promise((resolve) => {
        const socket = net.connect({host: '127.0.0.1', port});
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => resolve(false));
        socket.setTimeout(1500, () => {
            socket.destroy();
            resolve(false);
        });
    });
}

function docker(args) {
    const r = spawnSync('docker', args, {encoding: 'utf8', timeout: 20000});
    return {ok: r.status === 0, out: (r.stdout ?? '').trim()};
}

function imagePresent(reference) {
    const digest = reference.split('@')[1];
    const r = docker(['image', 'inspect', '--format', '{{json .RepoDigests}}', reference]);
    return r.ok && r.out.includes(`@${digest}"`);
}

export async function runDoctor({docker: withDocker = true, image = null} = {}) {
    const rows = [];
    const item = (name, ok, note = '') => rows.push({name, ok, note});
    const target = readJson(targetFile('release'));

    const major = Number(process.versions.node.split('.')[0]);
    item('node version', major >= 24, `v${process.versions.node} (needs 24 or newer)`);
    item('node strips TypeScript', Boolean(process.features.typescript), String(process.features.typescript));

    const link = path.join(PROTO_DIR, 'node_modules');
    let linkOk = false;
    try {
        linkOk =
            fs.lstatSync(link).isSymbolicLink() &&
            fs.readlinkSync(link) === '../e2e-tests/playwright/node_modules' &&
            fs.existsSync(path.join(link, '@playwright', 'test'));
    } catch {
        linkOk = false;
    }
    item(
        'explorer-proto/node_modules symlink',
        linkOk,
        linkOk
            ? 'points at e2e-tests/playwright/node_modules'
            : 'create: ln -s ../e2e-tests/playwright/node_modules explorer-proto/node_modules',
    );

    const pw = fs.existsSync(PLAYWRIGHT_PKG) ? readJson(PLAYWRIGHT_PKG).version : null;
    item(
        '@playwright/test version',
        pw === target.playwright_version,
        `${pw ?? 'missing'} (pinned ${target.playwright_version})`,
    );

    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
    const build = `${target.browser_build.name}-${target.browser_build.revision}`;
    item(`browser build ${build}`, fs.existsSync(path.join(cache, build)), 'in the Playwright cache');

    const license = Boolean(process.env.MM_LICENSE);
    item('MM_LICENSE present (name only)', license, license ? 'exported' : 'not exported');

    const port = Number(process.env.PILOT_PORT || 8065);
    item('fixed pilot port free', !(await portBusy(port)), 'the stack binds one fixed loopback port');

    const reference = image ? image.reference : imagePin('release');
    const refs = [reference, databasePin()];
    const skipDocker = !withDocker;
    if (skipDocker) {
        for (const name of [
            'docker reachable (linux/amd64)',
            'mattermost image present by digest',
            'database image present by digest',
            'no leftover pilot containers',
        ]) {
            rows.push({name, ok: 'skip', note: '--no-docker'});
        }
    } else {
        const info = docker(['version', '--format', '{{.Server.Os}}/{{.Server.Arch}}']);
        item(
            'docker reachable (linux/amd64)',
            info.ok && info.out === 'linux/amd64',
            info.ok ? info.out : 'docker server not reachable',
        );
        item('mattermost image present by digest', imagePresent(refs[0]), image ? 'override image' : 'the release pin');
        item('database image present by digest', imagePresent(refs[1]), 'the database pin');
        const left = docker(['ps', '-a', '--filter', 'name=explorer-pilot', '--format', '{{.Names}}']);
        item(
            'no leftover pilot containers',
            left.ok && left.out === '',
            left.ok ? `${left.out.split('\n').filter(Boolean).length} found` : 'docker not reachable',
        );
    }

    let failed = 0;
    for (const row of rows) {
        const label = {true: 'PASS', false: 'FAIL', skip: 'SKIP'}[row.ok];
        failed += row.ok === false ? 1 : 0;
        process.stdout.write(`${label} ${row.name}${row.note ? `: ${row.note}` : ''}\n`);
    }
    process.stdout.write(`doctor: ${failed === 0 ? 'PASS' : 'FAIL'} (${failed} failing)\n`);
    return failed === 0 ? EXIT.OK : EXIT.BLOCKED;
}
