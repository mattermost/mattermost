// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, setupFileServer, test} from '@mattermost/playwright-lib';

let fileServerUrl: string;
setupFileServer().then((serverUrl) => {
    fileServerUrl = serverUrl;
});

/**
 * @objective Verify collapsing a link preview is user-specific while removing it removes the preview for other users.
 */
test('MM-T199 Removing a link preview removes it from the views of other users', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, adminUser, userClient, team, user} = await pw.initSetup();

    // Use the in-repo OpenGraph fixture instead of a live third-party URL so preview
    // generation does not depend on an external site remaining scrapeable.
    await adminClient.patchConfig({
        ServiceSettings: {
            EnableLinkPreviews: true,
            AllowedUntrustedInternalConnections: new URL(fileServerUrl).hostname,
        },
    });

    await Promise.all([
        userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'display_settings', name: 'link_previews', value: 'true'},
            {user_id: user.id, category: 'display_settings', name: 'collapse_previews', value: 'false'},
        ]),
        adminClient.savePreferences(adminUser.id, [
            {user_id: adminUser.id, category: 'display_settings', name: 'link_previews', value: 'true'},
            {user_id: adminUser.id, category: 'display_settings', name: 'collapse_previews', value: 'false'},
        ]),
    ]);
    const offTopic = await userClient.getChannelByName(team.id, 'off-topic');

    // # The test user posts a link
    const post = await userClient.createPost({
        channel_id: offTopic.id,
        message: `${fileServerUrl}/opengraph-huge.html`,
    });

    // # Log in as the test user and open the channel
    const {app: userApp, page: userPage} = await pw.testBrowser.login(user);
    await userApp.channelsPage.goto({team, channel: offTopic});
    const userPost = userApp.center.postList.post(post);

    // * The link preview and its image are shown
    await expect(userPost.linkPreview.container).toBeVisible({timeout: pw.duration.half_min});
    await expect(userPost.linkPreview.image.container).toBeVisible();

    // # Log in as the other user and open the same channel
    const {app: adminApp, page: adminPage} = await pw.testBrowser.login(adminUser);
    await adminApp.channelsPage.goto({team, channel: offTopic});
    const adminPost = adminApp.center.postList.post(post);

    // * The other user also sees the expanded preview
    await expect(adminPost.linkPreview.container).toBeVisible({timeout: pw.duration.half_min});
    await expect(adminPost.linkPreview.image.container).toBeVisible();

    // # Collapse the preview's image as the test user
    await userPost.linkPreview.toggleButton.click();
    await expect(userPost.linkPreview.image.container).not.toBeVisible();

    // # Reload the channel as the other user
    await adminPage.reload();

    // * The preview's image is still expanded for the other user
    await expect(adminPost.linkPreview.image.container).toBeVisible({timeout: pw.duration.half_min});

    // # Remove the link preview as the test user
    await userPage.reload();
    await userPost.linkPreview.container.hover();
    await settle(userPost.linkPreview.removeButton, {wait: Api.PatchPost}).click();
    await expect(userPost.linkPreview.container).toHaveCount(0);

    // # Reload the channel as the other user
    await adminPage.reload();

    // * The preview is gone for the other user too
    await expect(adminPost).toBeVisible({timeout: pw.duration.half_min});
    await expect(adminPost.linkPreview.container).toHaveCount(0);
});
