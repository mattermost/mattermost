// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {uploadAndVerifyFile} from './file_storage_helpers';

/**
 * @objective Verify a file uploaded while FileSettings is configured for local disk storage (the
 * default) can be uploaded and downloaded back through Mattermost. Untagged, unlike the Minio/
 * Azurite specs: local is already every core test's default backend, so ensureLocalFile() here is
 * a no-op check rather than a disruptive restart, and this can run alongside normal core tests.
 *
 * @precondition
 * None beyond the default server config.
 */
test('uploads and retrieves a file backed by local disk storage', async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureLocalFile();

    const {userClient, team} = await pw.initSetup();

    await uploadAndVerifyFile(userClient, team.id);
});
