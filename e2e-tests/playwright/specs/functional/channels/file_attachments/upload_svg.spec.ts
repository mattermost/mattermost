// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {expect, test, Api, fileIdsOf, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify that an SVG file can be uploaded and posted when SVG support is enabled.
 *
 * @precondition
 * The server must have `ServiceSettings.EnableSVGs` set to `true`.
 */
test('MM-T309 uploads and posts an SVG file when SVG support is enabled', {tag: '@file_attachments'}, async ({pw}) => {
    // # Create and log in as a test user, and enable SVG support
    const {user, team, adminClient, userClient} = await pw.initSetup();
    await adminClient.patchConfig({ServiceSettings: {EnableSVGs: true}});
    const channel = await userClient.getChannelByName(team.id, 'off-topic');

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const composer = app.center.postCreate;

    // # Attach the SVG and post it with a message
    await settle(composer.uploadInput, {wait: Api.UploadFile}).chooseFiles(path.resolve('asset/vector_image.svg'));
    await expect(composer.filePreviews.fileList).toHaveKeyCount(1);
    const message = `This is an image ${pw.random.id()}`;
    await composer.message.container.fill(message);
    const post = await settle(composer.sendButton, {wait: Api.CreatePost}).click();

    // * The server created the post with the file, and the post shows it as an image
    expect(post.message).toBe(message);
    const [fileId] = fileIdsOf(post);
    await expect(app.center.postList.post(post).attachments.image({id: fileId})).toBeVisible();
});
