// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, duration, expect, settle, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal} from '../helpers';

test('should open Root Modal from post actions menu and all submenu items', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Post a message to use as the target post
    await app.center.postCreate.message.container.fill('Test post for Root Modal validation');
    await expect(app.center.postCreate.message.container).toHaveValue('Test post for Root Modal validation');
    const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    const post = app.center.postList.post({id: sent.id});
    await expect(post.message.container).toHaveText(sent.message);

    // Local helper: hover the post and open the actions (bolt icon) menu via the library
    // NOTE: Plugin actions are in the "actions" (⚡) button, NOT the "..." (more) button
    async function openActionsMenu() {
        await post.container.hover();
        await expect(post.menu.actionsButton).toBeVisible();
        await post.menu.actionsButton.click();
        await expect(post.menu.actionsMenu).toBeVisible();
    }

    // # Click the top-level "Demo Plugin" action
    await openActionsMenu();
    await app.page.getByRole('button', {name: 'Demo Plugin'}).click({timeout: duration.ten_sec});
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();

    // * Verify Root Modal opens — top-level action does NOT show "Element clicked in the menu"
    await assertRootModal(app.page);
    await expect(app.page.getByText(/Element clicked in the menu:/)).not.toBeVisible();
    await closeRootModal(app.page);

    // # Click Submenu Example → First Item
    await openActionsMenu();
    await app.page.getByRole('button', {name: /Submenu Example/}).hover();
    // Plugin submenu items have a broken aria-label; retain the text filter and observe the hovered submenu's target.
    const firstItem = app.page.getByRole('button').filter({hasText: 'First Item'}).last();
    await expect(firstItem).toBeVisible();
    await firstItem.click({timeout: duration.ten_sec});
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();

    // * Verify Root Modal opens with "First Item" as the clicked element
    await assertRootModal(app.page, 'First Item');
    await closeRootModal(app.page);

    // # Click Submenu Example → Second Item
    await openActionsMenu();
    await app.page.getByRole('button', {name: /Submenu Example/}).hover();
    // Plugin submenu items have a broken aria-label; retain the text filter and observe the hovered submenu's target.
    const secondItem = app.page.getByRole('button').filter({hasText: 'Second Item'}).last();
    await expect(secondItem).toBeVisible();
    await secondItem.click({timeout: duration.ten_sec});
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();

    // * Verify Root Modal opens with "Second Item" as the clicked element
    await assertRootModal(app.page, 'Second Item');
    await closeRootModal(app.page);

    // # Click Submenu Example → Third Item
    await openActionsMenu();
    await app.page.getByRole('button', {name: /Submenu Example/}).hover();
    // Plugin submenu items have a broken aria-label; retain the text filter and observe the hovered submenu's target.
    const thirdItem = app.page.getByRole('button').filter({hasText: 'Third Item'}).last();
    await expect(thirdItem).toBeVisible();
    await thirdItem.click({timeout: duration.ten_sec});
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();

    // * Verify Root Modal opens with "Third Item" as the clicked element
    await assertRootModal(app.page, 'Third Item');
    await closeRootModal(app.page);
});
