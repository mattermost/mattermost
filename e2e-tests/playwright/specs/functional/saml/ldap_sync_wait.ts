// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {duration, expect, wait} from '@mattermost/playwright-lib';

export async function runLdapSyncAndWait(adminClient: Client4) {
    const existingIds = new Set((await adminClient.getJobsByType('ldap_sync')).map((job) => job.id));
    await adminClient.syncLdap();

    // syncLdap() dispatches the job on a fire-and-forget goroutine and returns before the job row
    // necessarily exists, so its creation has to be polled for rather than read from the response.
    // Measured ~5-9ms locally; four_sec leaves generous headroom for a loaded CI runner.
    let createdIds: string[] = [];
    await expect(async () => {
        const jobs = await adminClient.getJobsByType('ldap_sync');
        createdIds = jobs.filter((job) => !existingIds.has(job.id)).map((job) => job.id);
        expect(createdIds.length).toBeGreaterThan(0);
    }).toPass({timeout: duration.four_sec, intervals: [duration.half_sec]});

    // The job server's watcher only checks for pending jobs every 15s (DefaultWatcherPollingInterval
    // in server/channels/jobs/jobs_watcher.go), so pickup alone can take up to that long in the worst
    // case; actual sync work on top of that measured 8-18s total locally across several runs.
    // half_min (30s) covers that worst case (~15s poll wait + up to ~15s of actual work/CI variance).
    const deadline = Date.now() + duration.half_min;
    while (true) {
        const jobs = await Promise.all(createdIds.map((id) => adminClient.getJob(id)));
        const failed = jobs.find((job) => job.status === 'error' || job.status === 'canceled');
        if (failed) {
            throw new Error(
                `ldap_sync job ${failed.id} ended with status ${failed.status}: ${JSON.stringify(failed.data)}`,
            );
        }
        if (jobs.every((job) => job.status === 'success')) {
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(
                `ldap_sync jobs did not succeed: ${JSON.stringify(jobs.map((job) => ({id: job.id, status: job.status, data: job.data})))}`,
            );
        }
        await wait(duration.two_sec);
    }
}
