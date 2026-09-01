// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

// A 1x1 transparent PNG, just to exercise a real write through the server's file backend.
const PROBE_IMAGE_BASE64_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** Uploads a throwaway profile image, exercising the server's real, live file backend. */
export async function uploadProbeImage(adminClient: Client4, adminUser: UserProfile | null): Promise<void> {
    if (!adminUser) {
        throw new Error('No admin user available to probe a real upload with.');
    }
    const probeImage = new File([Buffer.from(PROBE_IMAGE_BASE64_PNG, 'base64')], 'probe.png', {type: 'image/png'});
    await adminClient.uploadProfileImage(adminUser.id, probeImage);
}

/**
 * Restarts the server onto local disk storage if it isn't already there, and confirms a real
 * upload actually works — skipping the test otherwise, instead of failing on an unmet
 * precondition. The counterpart to ensureMinio()/ensureAzurite() for specs that specifically need
 * local storage active (e.g. after another spec in the same run switched it away).
 */
export async function ensureLocalFile(): Promise<void> {
    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - local file storage restart requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    try {
        const env = {MM_FILESETTINGS_DRIVERNAME: 'local'};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient, adminUser} = await getAdminClient();
        await uploadProbeImage(adminClient, adminUser);
    } catch (error) {
        test.skip(true, `Skipping test - local file storage check failed: ${String(error)}`);
    }
}
