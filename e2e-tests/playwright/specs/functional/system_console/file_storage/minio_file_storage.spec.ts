// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {uploadAndVerifyFile} from './file_storage_helpers';

/**
 * @objective Verify a file uploaded while FileSettings is configured for Minio S3-compatible
 * storage is actually written to the Minio bucket and can be downloaded back through Mattermost.
 *
 * @precondition
 * A Minio instance reachable at the configured FileSettings.AmazonS3Endpoint.
 */
test('uploads and retrieves a file backed by Minio S3 storage', async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureMinio();

    const {userClient, team} = await pw.initSetup();

    await uploadAndVerifyFile(userClient, team.id, () => pw.listMinioObjectKeys());
});
