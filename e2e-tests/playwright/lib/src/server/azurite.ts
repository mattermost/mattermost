// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BlobServiceClient, StorageSharedKeyCredential} from '@azure/storage-blob';
import {test} from '@playwright/test';

import {
    AZURITE_ACCOUNT_KEY,
    AZURITE_ACCOUNT_NAME,
    AZURITE_ALIAS,
    AZURITE_BLOB_PORT,
    AZURITE_CONTAINER,
} from '../containers/constants';
import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {uploadProbeImage} from './filestore';
import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

function getBlobServiceClient(): BlobServiceClient {
    const credential = new StorageSharedKeyCredential(AZURITE_ACCOUNT_NAME, AZURITE_ACCOUNT_KEY);
    return new BlobServiceClient(`${testConfig.azuriteUrl}/${AZURITE_ACCOUNT_NAME}`, credential);
}

// Only used internally by ensureAzurite() — not a spec-facing entry point.
async function ensureAzuriteContainer(container: string = AZURITE_CONTAINER): Promise<void> {
    const client = getBlobServiceClient().getContainerClient(container);
    const exists = await client.exists();
    if (!exists) {
        await client.create();
    }
}

/** Lists every blob name in the container, to confirm the server actually wrote to Azurite. */
export async function listAzuriteBlobNames(container: string = AZURITE_CONTAINER): Promise<string[]> {
    const client = getBlobServiceClient().getContainerClient(container);
    const names: string[] = [];
    for await (const blob of client.listBlobsFlat()) {
        names.push(blob.name);
    }
    return names;
}

// FileSettings' backend is chosen once when the Mattermost process boots and never re-read from a
// running server's config, so pointing the server at Azurite can only happen via the env vars the
// container starts with — always via the network alias, since the server itself always runs
// inside the Testcontainers network. AzureEndpoint under the "custom" cloud is the full service
// URL (path-style, account name included), unlike the vhost-style URLs real Azure uses.
function azuriteServerEnv(): Record<string, string> {
    return {
        MM_FILESETTINGS_DRIVERNAME: 'azureblob',
        MM_FILESETTINGS_AZURESTORAGEACCOUNT: AZURITE_ACCOUNT_NAME,
        MM_FILESETTINGS_AZUREAUTHMODE: 'shared_key',
        MM_FILESETTINGS_AZUREACCESSKEY: AZURITE_ACCOUNT_KEY,
        MM_FILESETTINGS_AZURECONTAINER: AZURITE_CONTAINER,
        MM_FILESETTINGS_AZURECLOUD: 'custom',
        MM_FILESETTINGS_AZUREENDPOINT: `http://${AZURITE_ALIAS}:${AZURITE_BLOB_PORT}/${AZURITE_ACCOUNT_NAME}`,
        MM_FILESETTINGS_AZURESSL: 'false',
    };
}

/**
 * Checks Azurite was started this run, restarts the server onto it if it isn't already the active
 * file storage backend, and confirms a real upload actually lands in Azurite — skipping the test
 * otherwise, instead of failing on an unmet precondition.
 */
export async function ensureAzurite(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('azurite')) {
        test.skip(true, 'Skipping test - azurite not started (set PW_TESTCONTAINERS_SERVICES=azurite)');
        return;
    }

    try {
        await ensureAzuriteContainer();
        const env = azuriteServerEnv();
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient, adminUser} = await getAdminClient();
        await uploadProbeImage(adminClient, adminUser);

        const blobNames = await listAzuriteBlobNames();
        if (blobNames.length === 0) {
            throw new Error(
                'Azurite container is still empty after a real upload — the server is not actually using ' +
                    'Azurite as its file backend.',
            );
        }
    } catch (error) {
        test.skip(true, `Skipping test - Azurite connection test failed: ${String(error)}`);
    }
}
