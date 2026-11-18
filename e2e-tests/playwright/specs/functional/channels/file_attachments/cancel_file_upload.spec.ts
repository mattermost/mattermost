// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a selected file can be removed from the message composer before posting.
 */
test('MM-T307 cancels a file upload', {tag: '@file_attachments'}, async ({pw}) => {
    const filename = 'vector_image.svg';
    const {adminClient, team, user, offTopic} = await pw.initSetup();
    await adminClient.patchConfig({ServiceSettings: {EnableSVGs: true}});

    // # Log in and open Off-Topic
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});
    const previews = app.center.postCreate.filePreviews;

    // # Select a file in the center-channel message composer
    await settle(app.center.postCreate.uploadInput, {wait: Api.UploadFile}).chooseFiles(
        path.resolve('asset', filename),
    );

    // * The upload preview shows the file
    await expect(previews.fileList).toHaveKeyCount(1);
    const [fileId] = await previews.fileList.keys();
    const preview = previews.file({id: fileId});
    await expect(preview.details).toContainText(filename);

    // # Remove the attachment from the upload preview
    await preview.removeButton.click();

    // * The upload preview is gone
    await expect(previews.fileList).toHaveKeyCount(0);
});
