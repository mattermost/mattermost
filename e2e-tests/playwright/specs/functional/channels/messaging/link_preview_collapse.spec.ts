// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setupFileServer, test} from '@mattermost/playwright-lib';

let fileServerUrl: string;
setupFileServer().then((serverUrl) => {
    fileServerUrl = serverUrl;
});

/**
 * @objective Verify the collapsed image preview preference hides OpenGraph preview images regardless of their size.
 */
test('collapsed image previews hide OpenGraph images of any size', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();

    // Use the in-repo OpenGraph fixtures instead of live third-party URLs so preview
    // generation does not depend on an external site remaining scrapeable.
    await adminClient.patchConfig({
        ServiceSettings: {
            EnableLinkPreviews: true,
            AllowedUntrustedInternalConnections: new URL(fileServerUrl).hostname,
        },
    });

    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'display_settings', name: 'link_previews', value: 'true'},
        {user_id: user.id, category: 'display_settings', name: 'collapse_previews', value: 'true'},
    ]);

    // # Post one link with a thumbnail-sized OpenGraph image and one with a large image
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    const smallImagePost = await adminClient.createPost({
        channel_id: offTopic.id,
        user_id: user.id,
        message: `${fileServerUrl}/opengraph.html`,
    });
    const largeImagePost = await adminClient.createPost({
        channel_id: offTopic.id,
        user_id: user.id,
        message: `${fileServerUrl}/opengraph-huge.html`,
    });

    // # Log in as the test user and open the channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, offTopic.name);
    await channelsPage.toBeVisible();

    const smallImagePreview = (await channelsPage.centerView.getPostById(smallImagePost.id)).getLinkPreview();
    const largeImagePreview = (await channelsPage.centerView.getPostById(largeImagePost.id)).getLinkPreview();

    // * Verify both previews render their card with the image hidden behind the preview control
    await smallImagePreview.toBeVisible(pw.duration.half_min);
    await smallImagePreview.toHaveCollapsedImage();
    await largeImagePreview.toBeVisible(pw.duration.half_min);
    await largeImagePreview.toHaveCollapsedImage();

    // # Reveal the thumbnail-sized image
    await smallImagePreview.showImage();

    // * Verify the thumbnail is shown without gaining the large-image collapse control
    await expect(smallImagePreview.hideImageButton).not.toBeVisible();

    // # Reveal the large image
    await largeImagePreview.showImage();

    // * Verify the large image keeps its collapse control and can be collapsed again
    await largeImagePreview.toHaveExpandedImage();
    await largeImagePreview.hideImage();
});
