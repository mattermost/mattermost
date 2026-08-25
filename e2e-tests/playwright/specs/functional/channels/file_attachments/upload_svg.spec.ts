// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that an SVG file can be uploaded and posted when SVG support is enabled.
 *
 * @precondition
 * The server must have `ServiceSettings.EnableSVGs` set to `true`.
 */
test('MM-T309 uploads and posts an SVG file when SVG support is enabled', {tag: '@file_attachments'}, async ({pw}) => {
    // # Create and log in as a test user, and enable SVG support
    const {user, team, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({ServiceSettings: {EnableSVGs: true}});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Post a message with an SVG attachment
    await channelsPage.postMessage(`This is an image ${pw.random.id()}`, ['vector_image.svg']);

    // * Verify the posted message renders the SVG as an image thumbnail
    const post = await channelsPage.getLastPost();
    await expect(post.container.getByLabel(/file thumbnail/i)).toBeVisible();
});
