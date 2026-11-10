// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {getAdminClientHealing} from './admin_lockout';
import {runMmctlLocal} from './mmctl';

import {testConfig} from '@/test_config';
import {duration, wait} from '@/util';

const PHASE2_MIGRATION_KEY = 'migration_advanced_permissions_phase_2';
const PHASE2_NOT_COMPLETED_ERROR_ID = 'app.schemes.is_phase_2_migration_completed.not_completed.app_error';

async function isPhase2MigrationCompleted(client: Client4): Promise<boolean> {
    try {
        await client.getSchemes('team', 0, 1);
        return true;
    } catch (error) {
        if ((error as {server_error_id?: string}).server_error_id === PHASE2_NOT_COMPLETED_ERROR_ID) {
            return false;
        }
        throw error;
    }
}

// The server's scheduler only starts the migration 60s after boot; create the job now unless one is already queued.
async function startPhase2Migration(client: Client4): Promise<void> {
    if (!testConfig.mattermostContainerId) {
        return;
    }

    const jobs = await client.getJobsByType('migrations', 0, 20);
    const queued = jobs.some(
        (job) => job.data?.migration_key === PHASE2_MIGRATION_KEY && ['pending', 'in_progress'].includes(job.status),
    );
    if (queued) {
        return;
    }

    const result = await runMmctlLocal([
        'job',
        'create',
        'migrations',
        '--data',
        `migration_key=${PHASE2_MIGRATION_KEY}`,
    ]);
    if (result.exitCode !== 0) {
        throw new Error(`Failed to create the permissions migration job: ${result.output}`);
    }
}

/**
 * Waits for the advanced permissions (phase 2) migration, which scheme API endpoints require, and starts it
 * without waiting for the server's scheduler. Call it in specs that use schemes.
 */
export async function ensurePhase2MigrationCompleted(timeout = duration.two_min): Promise<void> {
    const {adminClient} = await getAdminClientHealing();
    if (await isPhase2MigrationCompleted(adminClient)) {
        return;
    }

    await startPhase2Migration(adminClient);

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        await wait(duration.two_sec);

        if (await isPhase2MigrationCompleted(adminClient)) {
            return;
        }
    }

    throw new Error(`The permissions migration did not complete within ${timeout / 1000}s.`);
}
