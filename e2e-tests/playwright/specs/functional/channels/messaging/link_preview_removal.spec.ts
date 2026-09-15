// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, setupFileServer, test} from '@mattermost/playwright-lib';

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
    const message = `${fileServerUrl}/opengraph-huge.html`;

    // # Log in as the test user, post a link, and wait for its preview
    const {channelsPage: userChannelsPage, page: userPage} = await pw.testBrowser.login(user);
    await userChannelsPage.goto(team.name, 'off-topic');
    await userChannelsPage.toBeVisible();
    const postResponsePromise = userPage.waitForResponse(
        (response) => response.url().endsWith('/api/v4/posts') && response.request().method() === 'POST',
    );
    await userChannelsPage.postMessage(message);
    const postId = ((await (await postResponsePromise).json()) as {id: string}).id;
    const userPost = await userChannelsPage.centerView.getPostById(postId);
    const userPreview = userPost.getLinkPreview();

    // * Verify the link preview and its image are shown
    await userPreview.toBeVisible(pw.duration.half_min);
    await userPreview.toHaveExpandedImage();

    // # Log in as the other user and visit the same channel
    const {channelsPage: adminChannelsPage, page: adminPage} = await pw.testBrowser.login(adminUser);
    await adminChannelsPage.goto(team.name, 'off-topic');
    await adminChannelsPage.toBeVisible();
    const adminPost = await adminChannelsPage.centerView.getPostById(postId);
    const adminPreview = adminPost.getLinkPreview();

    // * Verify the other user also sees the expanded preview
    await adminPreview.toBeVisible(pw.duration.half_min);
    await adminPreview.toHaveExpandedImage();

    // # Collapse the preview as the test user
    await userPreview.hideImage();

    // # Reload the channel as the other user
    await adminPage.reload();
    await adminChannelsPage.toBeVisible();

    // * Verify the preview remains expanded for the other user
    await adminPreview.toHaveExpandedImage();

    // # Remove the link preview as the test user
    await userPage.reload();
    await userChannelsPage.toBeVisible();
    await userPreview.remove();

    // # Reload the channel as the other user
    await adminPage.reload();
    await adminChannelsPage.toBeVisible();

    // * Verify the preview is also removed for the other user
    await adminPreview.toNotBeVisible();
});

/**
 * @objective Verify a post clears its hover state when removing its link preview shrinks it away from a
 * stationary pointer.
 */
test('MM-61364 Removing a link preview clears the post hover state', {tag: '@messaging'}, async ({pw}) => {
    const {post, preview} = await postLinkWithPreview(pw);

    // # Hover the preview image, which sits far below where the post ends once the preview is gone
    await preview.image.hover();

    // * Verify the post is hovered and shows its quick actions
    await expect(post.container).toHaveClass(/post--hovered/);
    await expect(post.postMenu.dotMenuButton).toBeVisible();

    // # Remove the preview from the keyboard so the pointer stays where it is. The post then shrinks
    // # out from under the pointer, which the browser does not report as a mouseleave.
    await expect(preview.removeButton).toBeVisible();
    await preview.removeButton.press('Enter');
    await preview.toNotBeVisible();

    // * Verify the post no longer reports itself as hovered and hides its quick actions
    await expect(post.container).not.toHaveClass(/post--hovered/);
    await expect(post.postMenu.dotMenuButton).not.toBeVisible();
});

/**
 * @objective Verify a post keeps its hover state when it resizes while the pointer is still over it.
 */
test('MM-61364 A post resizing under the pointer keeps its quick actions', {tag: '@messaging'}, async ({pw}) => {
    const {adminUser, adminClient, postId, post, preview} = await postLinkWithPreview(pw);

    // # Hover the preview image
    await preview.image.hover();
    await expect(post.container).toHaveClass(/post--hovered/);
    await expect(post.postMenu.dotMenuButton).toBeVisible();

    // # Have another user react to the post, growing it while the pointer stays over it
    await adminClient.addReaction(adminUser.id, postId, 'smile');
    await expect(post.getReaction('smile')).toBeVisible();

    // * Verify the post is still hovered and still shows its quick actions
    await expect(post.container).toHaveClass(/post--hovered/);
    await expect(post.postMenu.dotMenuButton).toBeVisible();
});

// Logs in a fresh user and posts a link whose OpenGraph preview renders with an expanded image.
async function postLinkWithPreview(pw: PlaywrightExtended) {
    const {adminClient, adminUser, userClient, team, user} = await pw.initSetup();

    await adminClient.patchConfig({
        ServiceSettings: {
            EnableLinkPreviews: true,
            AllowedUntrustedInternalConnections: new URL(fileServerUrl).hostname,
        },
    });

    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'display_settings', name: 'link_previews', value: 'true'},
        {user_id: user.id, category: 'display_settings', name: 'collapse_previews', value: 'false'},
    ]);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    const postResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith('/api/v4/posts') && response.request().method() === 'POST',
    );
    await channelsPage.postMessage(`${fileServerUrl}/opengraph-huge.html`);
    const postId = ((await (await postResponsePromise).json()) as {id: string}).id;
    const post = await channelsPage.centerView.getPostById(postId);
    const preview = post.getLinkPreview();
    await preview.toBeVisible(pw.duration.half_min);
    await preview.toHaveExpandedImage();

    return {adminClient, adminUser, postId, post, preview};
}
