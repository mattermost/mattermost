// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

import {test} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {LOCAL_STORAGE_DIR} from '../containers/constants';
import {POSTGRES_IMAGE} from '../containers/default_images';
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

/**
 * Mattermost runs as UID 2000 and creates dated storage dirs mode 0750 (localstore.go). The host
 * runner cannot scandir those on Linux CI. Distroless server images have no chmod, so open the
 * bind mount via a one-shot helper container (postgres is always pulled with the stack).
 */
function makeLocalStorageHostReadable(): void {
    execFileSync(
        'docker',
        [
            'run',
            '--rm',
            '--user',
            '0',
            '-v',
            `${LOCAL_STORAGE_DIR}:/data`,
            POSTGRES_IMAGE,
            'chmod',
            '-R',
            'a+rX',
            '/data',
        ],
        {stdio: 'pipe'},
    );
}

/**
 * Lists every file under the bind-mounted local storage directory (see LOCAL_STORAGE_DIR),
 * confirming the server actually wrote to disk — the same "check the backend itself, not just
 * that the API says so" signal listMinioObjectKeys()/listAzuriteBlobNames() already provide for
 * their own backends.
 */
export function listLocalStorageFiles(): string[] {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
        return [];
    }
    try {
        return fs.readdirSync(LOCAL_STORAGE_DIR, {recursive: true}) as string[];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EACCES') {
            throw error;
        }
        makeLocalStorageHostReadable();
        return fs.readdirSync(LOCAL_STORAGE_DIR, {recursive: true}) as string[];
    }
}
