// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile, execFileSync} from 'node:child_process';
import {promisify} from 'node:util';

import {MATTERMOST_FIXED_HOST_PORT, TESTCONTAINERS_LABEL_KEY, TESTCONTAINERS_LABEL_VALUE} from './constants';
import {logTestcontainers} from './log';

const execFileAsync = promisify(execFile);

const STACK_LABEL_FILTER = `label=${TESTCONTAINERS_LABEL_KEY}=${TESTCONTAINERS_LABEL_VALUE}`;

/**
 * Removes running server containers of this stack that hold the server's host port, except `keepId`. Called with the
 * stack lock held, so a container that isn't the recorded server can only be left by a run that was killed
 * mid-start or mid-restart: it can't be reused and would make the next server fail with "port is already allocated".
 */
export async function removeOrphanedServerContainers(keepId?: string): Promise<void> {
    const {stdout} = await execFileAsync('docker', [
        'ps',
        '--no-trunc',
        '--filter',
        `publish=${MATTERMOST_FIXED_HOST_PORT}`,
        '--filter',
        STACK_LABEL_FILTER,
        '--format',
        '{{.ID}}\t{{.Names}}\t{{.Status}}',
    ]);

    for (const line of stdout.split('\n').filter(Boolean)) {
        const [id, name, status] = line.split('\t');
        if (id === keepId) {
            continue;
        }

        await execFileAsync('docker', ['rm', '-f', id]);
        logTestcontainers(
            `removed orphaned server container ${name} (${id.slice(0, 12)}, ${status}) holding port ` +
                `${MATTERMOST_FIXED_HOST_PORT}; left by an interrupted run.`,
        );
    }
}

/** Describes the Docker container publishing `port`, or undefined if none does. */
export async function describeDockerPortHolder(port: number): Promise<string | undefined> {
    const {stdout} = await execFileAsync('docker', [
        'ps',
        '--filter',
        `publish=${port}`,
        '--format',
        '{{.Names}} ({{.ID}}, {{.Image}}, {{.Status}})',
    ]);

    return stdout.split('\n').filter(Boolean)[0];
}

/** Ids of every container (any state) created from the server image. */
export function listServerContainerIdsSync(image: string): string[] {
    return execFileSync('docker', ['ps', '-aq', '--filter', `ancestor=${image}`], {encoding: 'utf-8'})
        .split('\n')
        .filter(Boolean);
}

export function removeContainersSync(ids: string[]): void {
    if (ids.length > 0) {
        execFileSync('docker', ['rm', '-f', ...ids], {stdio: 'ignore'});
    }
}
