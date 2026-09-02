// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {uploadAndVerifyFile} from './file_storage_helpers';

/**
 * @objective Verify a file uploaded while FileSettings is configured for Azure Blob storage
 * (against Azurite) can be uploaded and downloaded back through Mattermost.
 *
 * @precondition
 * An Azurite instance reachable at the configured FileSettings.AzureEndpoint.
 */
test('uploads and retrieves a file backed by Azure Blob storage', async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureAzurite();

    const {userClient, team} = await pw.initSetup();

    await uploadAndVerifyFile(userClient, team.id, () => pw.listAzuriteBlobNames());
});
