// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal} from '../helpers';

test('should show Demo Plugin User Attributes link in profile popover and close popover on click', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message so we have a post with the user's avatar to click
    await channelsPage.centerView.postCreate.input.fill('Test post for user attributes');
    await channelsPage.centerView.postCreate.sendMessage();

    // # Click the user's avatar to open the profile popover
    const post = await channelsPage.centerView.getLastPost();
    const profileImage = await post.getProfileImage(user.username);
    await profileImage.click();

    const popover = channelsPage.page.getByRole('dialog', {
        name: `${user.username}'s profile popover`,
    });
    await expect(popover).toBeVisible();

    // * Verify "Demo Plugin: User Attributes" link is present
    await expect(popover.getByText('Demo Plugin: User Attributes', {exact: true})).toBeVisible();

    // # Click the link
    await popover.getByText('Demo Plugin: User Attributes', {exact: true}).click();

    // * Verify it closes the popover
    await expect(popover).not.toBeVisible();
});

test('should open Root Modal from user profile popover Action button', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message so we have a post with the user's avatar to click
    await channelsPage.centerView.postCreate.input.fill('Test post for profile popover');
    await channelsPage.centerView.postCreate.sendMessage();

    // # Click the user's avatar on the post to open the profile popover
    const post = await channelsPage.centerView.getLastPost();
    const profileImage = await post.getProfileImage(user.username);
    await profileImage.click();

    // * Verify profile popover is visible with Demo Plugin Action button
    const popover = channelsPage.page.getByRole('dialog', {
        name: `${user.username}'s profile popover`,
    });
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Demo Plugin: User Attributes')).toBeVisible();
    await expect(popover.getByRole('button', {name: 'Action'})).toBeVisible();

    // # Click the Action button
    await popover.getByRole('button', {name: 'Action'}).click();

    // * Verify the popover closes and Root Modal appears
    await expect(popover).not.toBeVisible();
    await assertRootModal(channelsPage.page);

    await closeRootModal(channelsPage.page);
});
