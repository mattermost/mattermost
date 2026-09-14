// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect} from '@mattermost/playwright-lib';

export async function runLdapSyncAndWait(adminClient: Client4) {
    const existingIds = new Set((await adminClient.getJobsByType('ldap_sync')).map((job) => job.id));
    await adminClient.syncLdap();

    let createdIds: string[] = [];
    await expect(async () => {
        const jobs = await adminClient.getJobsByType('ldap_sync');
        createdIds = jobs.filter((job) => !existingIds.has(job.id)).map((job) => job.id);
        expect(createdIds.length).toBeGreaterThan(0);
    }).toPass({timeout: 15_000, intervals: [500]});

    const deadline = Date.now() + 90_000;
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
        await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
}
