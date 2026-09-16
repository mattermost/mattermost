// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a selected file can be removed from the message composer before posting.
 */
test('MM-T307 cancels a file upload', {tag: '@file_attachments'}, async ({pw}) => {
    const filename = 'vector_image.svg';
    const {adminClient, team, user} = await pw.initSetup();
    await adminClient.patchConfig({ServiceSettings: {EnableSVGs: true}});

    // # Log in and open Off-Topic
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Select an image in the center-channel message composer
    const file = pw.getFileFromAsset(filename);
    await channelsPage.centerView.postCreate.selectFiles(file);

    // * Verify the upload preview shows its thumbnail and filename
    await channelsPage.centerView.postCreate.toHaveFilePreview(filename);

    // # Remove the attachment from the upload preview
    await channelsPage.centerView.postCreate.removeFilePreview(filename);

    // * Verify the upload preview disappears
    await channelsPage.centerView.postCreate.toHaveFilePreviewCount(0);
});
