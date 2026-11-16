// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the forward-post channel selector normalizes search results, selects a destination, and
 * forwards the post there.
 */
test('forward post channel selector searches and selects a destination channel', {tag: '@channels'}, async ({pw}) => {
    const {team, user, adminClient} = await pw.initSetup();
    const target = await adminClient.createPublicChannel(team.id, `Forward Target ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, target.id);

    const message = `forward-selector-${pw.random.id()}`;
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(message);

    // # Open the Forward message modal from the posted message
    const post = await channelsPage.getLastPost();
    const postId = await post.getId();
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.openDotMenu();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.forwardMenuItem.click();

    const modal = page.getByRole('dialog', {name: 'Forward message'});
    await expect(modal).toBeVisible();

    // # Search for a destination that was not recently viewed, exercising the provider normalization path.
    // # react-select renders the combobox itself and drops the data-testid given to it, so find it by role.
    const input = modal.getByRole('combobox');
    await input.fill(target.display_name);

    const option = page.getByRole('option').filter({hasText: target.display_name}).first();
    await expect(option).toBeVisible();
    await option.click();

    // * Verify selecting the normalized channel result enables forwarding
    const forwardButton = modal.getByRole('button', {name: 'Forward', exact: true});
    await expect(forwardButton).toBeEnabled();

    // # Forward the post and verify it arrives in the selected channel
    await forwardButton.click();
    await expect(modal).not.toBeVisible();

    await channelsPage.goto(team.name, target.name);
    await channelsPage.toBeVisible();

    // * Verify the forwarded post links back to the original. Assert on the permalink rather than the
    // * original message because the permalink preview that renders the message is only generated when the
    // * link matches the server's SiteURL, which isn't the origin the browser uses in every environment.
    await channelsPage.centerView.waitUntilLastPostContains(`/pl/${postId}`);
});

/**
 * @objective Verify that forwarding a post to a public channel the user has not joined joins the user to that
 * channel and posts the forwarded message there.
 */
test(
    'MM-71780 forward post to an unjoined public channel joins the channel and forwards the post',
    {tag: '@channels'},
    async ({pw}) => {
        const {team, user, adminClient} = await pw.initSetup();
        const target = await adminClient.createPublicChannel(team.id, `Unjoined Public ${pw.random.id()}`);

        const message = `forward-unjoined-${pw.random.id()}`;
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.postMessage(message);

        // # Open the Forward message modal from the posted message
        const post = await channelsPage.getLastPost();
        const postId = await post.getId();
        await post.hover();
        await post.postMenu.toBeVisible();
        await post.postMenu.openDotMenu();
        await channelsPage.postDotMenu.toBeVisible();
        await channelsPage.postDotMenu.forwardMenuItem.click();

        const modal = page.getByRole('dialog', {name: 'Forward message'});
        await expect(modal).toBeVisible();

        // # Select the public channel the user is not a member of
        await modal.getByRole('combobox').fill(target.display_name);
        const option = page.getByRole('option').filter({hasText: target.display_name}).first();
        await expect(option).toBeVisible();
        await option.click();

        // * Verify forwarding is allowed even though the user has not joined the channel
        const forwardButton = modal.getByRole('button', {name: 'Forward', exact: true});
        await expect(forwardButton).toBeEnabled();

        // # Forward the post
        await forwardButton.click();
        await expect(modal).not.toBeVisible();

        // * Verify the user was joined to the channel, switched to it, and the forwarded post is there
        await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${target.name}$`));
        const member = await adminClient.getChannelMember(target.id, user.id);
        expect(member.user_id).toBe(user.id);
        await channelsPage.centerView.waitUntilLastPostContains(`/pl/${postId}`);
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
        const {team, user, adminClient} = await pw.initSetup();
        const target = await adminClient.createPublicChannel(team.id, `Unjoined Public ${pw.random.id()}`);

        // # Remove the permission to join public channels from team members
        const teamUserRole = await adminClient.getRoleByName('team_user');
        await adminClient.patchRole(teamUserRole.id, {
            permissions: teamUserRole.permissions.filter((permission) => permission !== 'join_public_channels'),
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.postMessage(`forward-unjoined-denied-${pw.random.id()}`);

        // # Open the Forward message modal from the posted message
        const post = await channelsPage.getLastPost();
        await post.hover();
        await post.postMenu.toBeVisible();
        await post.postMenu.openDotMenu();
        await channelsPage.postDotMenu.toBeVisible();
        await channelsPage.postDotMenu.forwardMenuItem.click();

        const modal = page.getByRole('dialog', {name: 'Forward message'});
        await expect(modal).toBeVisible();

        // # Select the public channel the user is not a member of
        await modal.getByRole('combobox').fill(target.display_name);
        const option = page.getByRole('option').filter({hasText: target.display_name}).first();
        await expect(option).toBeVisible();
        await option.click();
        await expect(modal.locator(`#post-forward_channel-select_singleValue_${target.id}`)).toBeVisible();

        // * Verify forwarding is not allowed since the user cannot join the channel
        await expect(modal.getByRole('button', {name: 'Forward', exact: true})).toBeDisabled();
    },
);
