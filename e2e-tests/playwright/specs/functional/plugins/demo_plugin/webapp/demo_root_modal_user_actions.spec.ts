// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal, setupDemoPlugin} from '../helpers';

test('should show Demo Plugin User Attributes link in profile popover and close popover on click', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Post a message so we have a post with the user's avatar to click
    await channelsPage.centerView.postCreate.input.fill('Test post for user attributes');
    await channelsPage.centerView.postCreate.sendMessage();

    // 4. Click the user's avatar to open the profile popover
    const post = await channelsPage.centerView.getLastPost();
    const profileImage = await post.getProfileImage(user.username);
    await profileImage.click();

    const popover = channelsPage.page.getByRole('dialog', {
        name: `${user.username}'s profile popover`,
    });
    await expect(popover).toBeVisible();

    // 5. Confirm "Demo Plugin: User Attributes" link is present
    await expect(popover.getByText('Demo Plugin: User Attributes', {exact: true})).toBeVisible();

    // 6. Click the link — it should close the popover
    await popover.getByText('Demo Plugin: User Attributes', {exact: true}).click();
    await expect(popover).not.toBeVisible();
});

test('should open Root Modal from user profile popover Action button', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Post a message so we have a post with the user's avatar to click
    await channelsPage.centerView.postCreate.input.fill('Test post for profile popover');
    await channelsPage.centerView.postCreate.sendMessage();

    // 4. Click the user's avatar on the post to open the profile popover
    const post = await channelsPage.centerView.getLastPost();
    const profileImage = await post.getProfileImage(user.username);
    await profileImage.click();

    // 5. Confirm profile popover is visible with Demo Plugin Action button
    const popover = channelsPage.page.getByRole('dialog', {
        name: `${user.username}'s profile popover`,
    });
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Demo Plugin: User Attributes')).toBeVisible();
    await expect(popover.getByRole('button', {name: 'Action'})).toBeVisible();

    // 6. Click Action button → Root Modal should appear
    await popover.getByRole('button', {name: 'Action'}).click();
    await expect(popover).not.toBeVisible();

    // 7. Assert Root Modal
    await assertRootModal(channelsPage.page);

    // 8. Close modal by clicking its text
    await closeRootModal(channelsPage.page);
});
