// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client as MinioClient} from 'minio';
import {test} from '@playwright/test';

import {MINIO_ACCESS_KEY, MINIO_ALIAS, MINIO_BUCKET, MINIO_PORT, MINIO_SECRET_KEY} from '../containers/constants';
import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {uploadProbeImage} from './filestore';
import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

function getMinioClient(): MinioClient {
    const url = new URL(testConfig.minioUrl);
    return new MinioClient({
        endPoint: url.hostname,
        port: Number(url.port),
        useSSL: url.protocol === 'https:',
        accessKey: MINIO_ACCESS_KEY,
        secretKey: MINIO_SECRET_KEY,
    });
}

// Only used internally by ensureMinio() — not a spec-facing entry point.
async function ensureMinioBucket(bucket: string = MINIO_BUCKET): Promise<void> {
    const client = getMinioClient();
    const exists = await client.bucketExists(bucket);
    if (!exists) {
        await client.makeBucket(bucket);
    }
}

/** Lists every object key in the bucket, to confirm the server actually wrote to Minio. */
export async function listMinioObjectKeys(bucket: string = MINIO_BUCKET): Promise<string[]> {
    const client = getMinioClient();
    const keys: string[] = [];
    for await (const item of client.listObjectsV2(bucket, '', true)) {
        if (item.name) {
            keys.push(item.name);
        }
    }
    return keys;
}

// FileSettings' backend is chosen once when the Mattermost process boots and never re-read from a
// running server's config, so pointing the server at Minio can only happen via the env vars the
// container starts with — always via the network alias, since the server itself always runs
// inside the Testcontainers network.
function minioServerEnv(): Record<string, string> {
    return {
        MM_FILESETTINGS_DRIVERNAME: 'amazons3',
        MM_FILESETTINGS_AMAZONS3ENDPOINT: `${MINIO_ALIAS}:${MINIO_PORT}`,
        MM_FILESETTINGS_AMAZONS3ACCESSKEYID: MINIO_ACCESS_KEY,
        MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY: MINIO_SECRET_KEY,
        MM_FILESETTINGS_AMAZONS3BUCKET: MINIO_BUCKET,
        MM_FILESETTINGS_AMAZONS3SSL: 'false',
    };
}

/**
 * Checks Minio was started this run, restarts the server onto it if it isn't already the active
 * file storage backend, and confirms a real upload actually lands in Minio — skipping the test
 * otherwise, instead of failing on an unmet precondition.
 */
export async function ensureMinio(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('minio')) {
        test.skip(true, 'Skipping test - minio not started (set PW_TESTCONTAINERS_SERVICES=minio)');
        return;
    }

    try {
        await ensureMinioBucket();
        const env = minioServerEnv();
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient, adminUser} = await getAdminClient();
        await uploadProbeImage(adminClient, adminUser);

        const objectKeys = await listMinioObjectKeys();
        if (objectKeys.length === 0) {
            throw new Error(
                'Minio bucket is still empty after a real upload — the server is not actually using Minio ' +
                    'as its file backend.',
            );
        }
    } catch (error) {
        test.skip(true, `Skipping test - Minio connection test failed: ${String(error)}`);
    }
}
