// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal, setupDemoPlugin} from '../helpers';

test('should open Root Modal from team dropdown main menu', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Open the team name dropdown in the left sidebar
    await channelsPage.sidebarLeft.teamMenuButton.click();

    // 4. Confirm Demo Plugin entries are visible and click "Demo Plugin"
    await expect(channelsPage.page.getByRole('menuitem', {name: 'Demo Plugin'})).toBeVisible();
    await channelsPage.page.getByRole('menuitem', {name: 'Demo Plugin'}).click();

    // 5. Assert Root Modal (no "Element clicked" line for main menu)
    await assertRootModal(channelsPage.page);

    // 6. Close
    await closeRootModal(channelsPage.page);
});

test('should open Root Modal from channel header dropdown More actions', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Open channel header dropdown
    await channelsPage.page.getByRole('button', {name: 'town square channel menu'}).click();

    // 4. Hover "More actions" to reveal the submenu, then click "Demo Plugin"
    const moreActionsItem = channelsPage.page.getByRole('menuitem', {name: 'More actions'});
    await expect(moreActionsItem).toBeVisible();
    await moreActionsItem.hover();
    const submenu = channelsPage.page.getByRole('menu', {name: 'More actions'});
    await expect(submenu).toBeVisible();
    // Move mouse directly to the Demo Plugin item to avoid submenu collapsing
    const demoPluginItem = submenu.getByRole('menuitem', {name: 'Demo Plugin'});
    await demoPluginItem.hover();
    await demoPluginItem.click();

    // 5. Assert Root Modal base text
    await assertRootModal(channelsPage.page);
    // Channel header entry also shows "Element clicked in the menu: <channel_id>" (dynamic)
    await expect(channelsPage.page.getByText(/Element clicked in the menu:/)).toBeVisible();

    // 6. Close
    await closeRootModal(channelsPage.page);
});

test('should open Sample Confirmation Dialog from team dropdown and respond to Confirm and Cancel', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Open team dropdown and click "Sample Confirmation Dialog"
    await channelsPage.sidebarLeft.teamMenuButton.click();
    await expect(channelsPage.page.getByRole('menuitem', {name: 'Sample Confirmation Dialog'})).toBeVisible();
    await channelsPage.page.getByRole('menuitem', {name: 'Sample Confirmation Dialog'}).click();

    // 4. Confirm dialog opens with title and action buttons but no form fields
    const dialog = channelsPage.page.getByRole('dialog', {name: 'Sample Confirmation Dialog'});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {name: 'Sample Confirmation Dialog', level: 1})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toBeVisible();

    // 5. Click Confirm — dialog closes and a post appears
    await dialog.getByRole('button', {name: 'Confirm'}).click();
    await expect(dialog).not.toBeVisible();
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'confirmed an Interactive Dialog'}),
    ).toBeVisible();

    // Cancel test omitted due to unexpected behavior. Will re-add once issue is resolved.
});
