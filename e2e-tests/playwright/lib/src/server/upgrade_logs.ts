// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';

import {TESTCONTAINERS_LABEL_KEY, TESTCONTAINERS_LABEL_VALUE} from '../containers/constants';
import {logTestcontainers} from '../containers/log';

import {testConfig} from '@/test_config';

const execFileAsync = promisify(execFile);

export type UpgradeLogPhase = 'from' | 'to';

const UPGRADE_LOG_DIR = path.resolve(process.cwd(), 'logs', 'upgrade');
const BASELINE_PATH = path.resolve(process.cwd(), '.upgrade_baseline.json');

/** Lines worth skimming in CI when diagnosing a failed rolling upgrade. */
const HIGHLIGHT_PATTERNS: RegExp[] = [
    /All migrations are complete/i,
    /\bmigration\b/i,
    /\bschema\b/i,
    /\blicense\b/i,
    /\bpanic\b/i,
    /\bfatal\b/i,
    /failed to/i,
    /error.*upgrade/i,
    /current version is/i,
    /database.*version/i,
];

/**
 * Snapshots Mattermost (and Postgres) container logs for an upgrade phase into
 * `logs/upgrade/`, which CI already uploads via `ci/upload-debug-artifacts`.
 *
 * Must run for `from` before upgrade-swap-to replaces the Mattermost container —
 * teardown-only collection would only ever see the to-image.
 */
export async function saveUpgradePhaseLogs(phase: UpgradeLogPhase): Promise<void> {
    if (!testConfig.useTestContainers) {
        return;
    }

    fs.mkdirSync(UPGRADE_LOG_DIR, {recursive: true});

    if (testConfig.mattermostContainerId) {
        await writeDockerLogs(
            testConfig.mattermostContainerId,
            path.join(UPGRADE_LOG_DIR, `${phase}-mattermost.log`),
            path.join(UPGRADE_LOG_DIR, `${phase}-mattermost.highlights.txt`),
        );
    } else {
        logTestcontainers(`saveUpgradePhaseLogs(${phase}): no Mattermost container id — skipped`);
    }

    const postgresId = await findLabeledContainerId(/postgres/i);
    if (postgresId) {
        await writeDockerLogs(postgresId, path.join(UPGRADE_LOG_DIR, `${phase}-postgres.log`));
    }

    if (phase === 'from' && fs.existsSync(BASELINE_PATH)) {
        fs.copyFileSync(BASELINE_PATH, path.join(UPGRADE_LOG_DIR, 'from-baseline.json'));
    }

    logTestcontainers(`saveUpgradePhaseLogs(${phase}): wrote artifacts under logs/upgrade/`);
}

async function writeDockerLogs(containerId: string, outPath: string, highlightsPath?: string): Promise<void> {
    try {
        const {stdout, stderr} = await execFileAsync('docker', ['logs', containerId], {
            maxBuffer: 64 * 1024 * 1024,
            encoding: 'utf-8',
        });
        const body = [stdout, stderr].filter(Boolean).join('\n');
        fs.writeFileSync(outPath, body, 'utf-8');

        if (highlightsPath) {
            const highlights = body
                .split('\n')
                .filter((line) => HIGHLIGHT_PATTERNS.some((pattern) => pattern.test(line)));
            fs.writeFileSync(
                highlightsPath,
                highlights.length
                    ? highlights.join('\n') + '\n'
                    : '(no migration/license/panic/fatal highlight lines matched)\n',
                'utf-8',
            );
        }
    } catch (error) {
        logTestcontainers(`saveUpgradePhaseLogs: docker logs failed for ${containerId.slice(0, 12)}: ${String(error)}`);
    }
}

/** Finds a still-running Testcontainers-labeled container whose image matches `imagePattern`. */
async function findLabeledContainerId(imagePattern: RegExp): Promise<string | undefined> {
    try {
        const {stdout} = await execFileAsync('docker', [
            'ps',
            '-aq',
            '--filter',
            `label=${TESTCONTAINERS_LABEL_KEY}=${TESTCONTAINERS_LABEL_VALUE}`,
        ]);
        const ids = stdout
            .split('\n')
            .map((id) => id.trim())
            .filter(Boolean);

        for (const id of ids) {
            const {stdout: image} = await execFileAsync('docker', ['inspect', '-f', '{{.Config.Image}}', id]);
            if (imagePattern.test(image.trim())) {
                return id;
            }
        }
    } catch {
        // Best-effort — missing postgres must not fail the upgrade suite.
    }
    return undefined;
}
