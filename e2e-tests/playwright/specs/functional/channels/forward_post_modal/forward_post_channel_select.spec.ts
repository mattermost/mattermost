// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, lastPost, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the forward-post channel selector normalizes search results, selects a destination, and
 * forwards the post there.
 */
test('forward post channel selector searches and selects a destination channel', {tag: '@channels'}, async ({pw}) => {
    const {team, user, userClient, adminClient, townSquare} = await pw.initSetup();
    const target = await adminClient.createPublicChannel(team.id, `Forward Target ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, target.id);
    const message = `forward-selector-${pw.random.id()}`;
    const post = await userClient.createPost({channel_id: townSquare.id, message});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open Forward from the post's dot menu
    const shown = app.center.postList.post(post);
    await shown.container.hover();
    await shown.menu.dotMenuButton.clickTo(app.postDotMenu);
    const forward = await app.postDotMenu.forwardMenuItem.clickTo(app.forwardPostModal);

    // # Search for the target channel and select it
    await forward.channelSelectCombobox.fill(target.display_name);
    await forward.channel(target).select();
    await expect(forward.selectedChannelText).toContainText(target.display_name);

    // # Forward the post
    await expect(forward.confirmButton).toBeEnabled();
    await settle(forward.confirmButton, {wait: Api.CreatePost}).click();
    await expect(forward.confirmButton).not.toBeVisible();

    // * Verify the target channel's latest post links back to the original. Not the permalink preview: the server
    // * only generates it when the link matches its SiteURL, which isn't the origin the browser uses everywhere.
    await app.channelsPage.goto({team, channel: target});
    await expect(await lastPost(app.center.postList)).toContainText(`/pl/${post.id}`);
});

/**
 * @objective Verify that forwarding a post to a public channel the user has not joined joins the user to that
 * channel and posts the forwarded message there.
 */
test(
    'MM-71780 forward post to an unjoined public channel joins the channel and forwards the post',
    {tag: '@channels'},
    async ({pw}) => {
        const {team, user, userClient, adminClient, townSquare} = await pw.initSetup();
        const target = await adminClient.createPublicChannel(team.id, `Unjoined Public ${pw.random.id()}`);
        const post = await userClient.createPost({
            channel_id: townSquare.id,
            message: `forward-unjoined-${pw.random.id()}`,
        });

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open the Forward message modal from the posted message
        const shown = app.center.postList.post(post);
        await shown.container.hover();
        await shown.menu.dotMenuButton.clickTo(app.postDotMenu);
        const forward = await app.postDotMenu.forwardMenuItem.clickTo(app.forwardPostModal);

        // # Select the public channel the user is not a member of
        await forward.channelSelectCombobox.fill(target.display_name);
        await forward.channel(target).select();

        // * Verify forwarding is allowed even though the user has not joined the channel
        await expect(forward.confirmButton).toBeEnabled();

        // # Forward the post
        await settle(forward.confirmButton, {wait: Api.CreatePost}).click();
        await expect(forward.confirmButton).not.toBeVisible();

        // * Verify the user was joined to the channel, switched to it, and the forwarded post is there
        await expect(page).toHavePath(app.channelsPage.pathFor({team, channel: target}));
        const member = await adminClient.getChannelMember(target.id, user.id);
        expect(member.user_id).toBe(user.id);
        await expect(await lastPost(app.center.postList)).toContainText(`/pl/${post.id}`);
    },
);

/**
 * @objective Verify that forwarding to an unjoined public channel stays disabled when the user is not permitted to
 * join public channels.
 */
test(
    'MM-71780 forward post to an unjoined public channel is disabled without permission to join public channels',
    {tag: '@channels'},
    async ({pw}) => {
        const {team, user, userClient, adminClient, townSquare} = await pw.initSetup();
        const target = await adminClient.createPublicChannel(team.id, `Unjoined Public ${pw.random.id()}`);
        const post = await userClient.createPost({
            channel_id: townSquare.id,
            message: `forward-unjoined-denied-${pw.random.id()}`,
        });

        // # Remove the permission to join public channels from team members
        const teamUserRole = await adminClient.getRoleByName('team_user');
        await adminClient.patchRole(teamUserRole.id, {
            permissions: teamUserRole.permissions.filter((permission) => permission !== 'join_public_channels'),
        });

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open the Forward message modal from the posted message
        const shown = app.center.postList.post(post);
        await shown.container.hover();
        await shown.menu.dotMenuButton.clickTo(app.postDotMenu);
        const forward = await app.postDotMenu.forwardMenuItem.clickTo(app.forwardPostModal);

        // # Select the public channel the user is not a member of
        await forward.channelSelectCombobox.fill(target.display_name);
        await forward.channel(target).select();
        await expect(forward.selectedChannelText).toContainText(target.display_name);

        // * Verify forwarding is not allowed since the user cannot join the channel
        await expect(forward.confirmButton).toBeDisabled();
    },
);
