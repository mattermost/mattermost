// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal} from '../helpers';

test('should open Root Modal from post actions menu and all submenu items', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message to use as the target post
    await channelsPage.centerView.postCreate.input.fill('Test post for Root Modal validation');
    await channelsPage.centerView.postCreate.sendMessage();

    const post = await channelsPage.centerView.getLastPost();

    // Local helper: hover the post and open the actions (bolt icon) menu via the library
    // NOTE: Plugin actions are in the "actions" (⚡) button, NOT the "..." (more) button
    async function openActionsMenu() {
        await post.hover();
        await post.postMenu.actionsButton.click();
    }

    // # Click the top-level "Demo Plugin" action
    await openActionsMenu();
    await channelsPage.page.getByRole('button', {name: 'Demo Plugin'}).click();

    // * Verify Root Modal opens — top-level action does NOT show "Element clicked in the menu"
    await assertRootModal(channelsPage.page);
    await expect(channelsPage.page.getByText(/Element clicked in the menu:/)).not.toBeVisible();
    await closeRootModal(channelsPage.page);

    // # Click Submenu Example → First Item
    await openActionsMenu();
    await channelsPage.page.getByRole('button', {name: /Submenu Example/}).hover();
    // Submenu items have role="button" but a broken aria-label — filter by text content
    await channelsPage.page.getByRole('button').filter({hasText: 'First Item'}).last().click();

    // * Verify Root Modal opens with "First Item" as the clicked element
    await assertRootModal(channelsPage.page, 'First Item');
    await closeRootModal(channelsPage.page);

    // # Click Submenu Example → Second Item
    await openActionsMenu();
    await channelsPage.page.getByRole('button', {name: /Submenu Example/}).hover();
    await channelsPage.page.getByRole('button').filter({hasText: 'Second Item'}).last().click();

    // * Verify Root Modal opens with "Second Item" as the clicked element
    await assertRootModal(channelsPage.page, 'Second Item');
    await closeRootModal(channelsPage.page);

    // # Click Submenu Example → Third Item
    await openActionsMenu();
    await channelsPage.page.getByRole('button', {name: /Submenu Example/}).hover();
    await channelsPage.page.getByRole('button').filter({hasText: 'Third Item'}).last().click();

    // * Verify Root Modal opens with "Third Item" as the clicked element
    await assertRootModal(channelsPage.page, 'Third Item');
    await closeRootModal(channelsPage.page);
});
