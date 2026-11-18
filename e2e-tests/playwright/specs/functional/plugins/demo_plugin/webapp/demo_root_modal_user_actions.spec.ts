// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal} from '../helpers';

test('should show Demo Plugin User Attributes link in profile popover and close popover on click', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Post a message so we have a post with the user's avatar to click
    await app.center.postCreate.message.container.fill('Test post for user attributes');
    await expect(app.center.postCreate.message.container).toHaveValue('Test post for user attributes');
    const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // # Click the user's avatar to open the profile popover
    const post = app.center.postList.post({id: sent.id});
    await expect(post.message.container).toHaveText(sent.message);
    // The generated avatar scope has no image part; its native alt text verifies the target user's identity.
    const profileImage = post.avatar.container.locator.getByAltText(`${user.username} profile image`);
    await profileImage.click();

    const popover = app.page.getByRole('dialog', {
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
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Post a message so we have a post with the user's avatar to click
    await app.center.postCreate.message.container.fill('Test post for profile popover');
    await expect(app.center.postCreate.message.container).toHaveValue('Test post for profile popover');
    const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // # Click the user's avatar on the post to open the profile popover
    const post = app.center.postList.post({id: sent.id});
    await expect(post.message.container).toHaveText(sent.message);
    // The generated avatar scope has no image part; its native alt text verifies the target user's identity.
    const profileImage = post.avatar.container.locator.getByAltText(`${user.username} profile image`);
    await profileImage.click();

    // * Verify profile popover is visible with Demo Plugin Action button
    const popover = app.page.getByRole('dialog', {
        name: `${user.username}'s profile popover`,
    });
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Demo Plugin: User Attributes')).toBeVisible();
    await expect(popover.getByRole('button', {name: 'Action'})).toBeVisible();

    // # Click the Action button
    await popover.getByRole('button', {name: 'Action'}).click();

    // * Verify the popover closes and Root Modal appears
    await expect(popover).not.toBeVisible();
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();
    await assertRootModal(app.page);

    await closeRootModal(app.page);
});
