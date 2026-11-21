// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal} from '../helpers';

test('should open Root Modal from team dropdown main menu', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Open the team name dropdown in the left sidebar
    await app.lhs.header.openTeamMenuButton.click();
    await expect(app.lhs.teamMenu).toBeVisible();

    // * Verify Demo Plugin entries are visible
    await expect(app.page.getByRole('menuitem', {name: 'Demo Plugin'})).toBeVisible();

    // # Click "Demo Plugin"
    await app.page.getByRole('menuitem', {name: 'Demo Plugin'}).click();
    await expect(app.page.getByRole('menuitem', {name: 'Demo Plugin'})).not.toBeVisible();

    // * Verify Root Modal opens (no "Element clicked" line for main menu)
    await assertRootModal(app.page);

    await closeRootModal(app.page);
});

test('should open Root Modal from channel header dropdown More actions', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Open channel header dropdown
    await app.channelHeader.openMenuButton.click();

    // # Hover "More actions" to reveal the submenu, then click "Demo Plugin"
    const moreActionsItem = app.page.getByRole('menuitem', {name: 'More actions'});
    await expect(moreActionsItem).toBeVisible();
    await moreActionsItem.hover();
    const submenu = app.page.getByRole('menu', {name: 'More actions'});
    await expect(submenu).toBeVisible();
    // Move mouse directly to the Demo Plugin item to avoid submenu collapsing
    const demoPluginItem = submenu.getByRole('menuitem', {name: 'Demo Plugin'});
    await demoPluginItem.hover();
    await expect(demoPluginItem).toBeVisible();
    await demoPluginItem.click();
    await expect(demoPluginItem).not.toBeVisible();

    // * Verify Root Modal opens with base text
    await assertRootModal(app.page);
    // Channel header entry also shows "Element clicked in the menu: <channel_id>" (dynamic)
    await expect(app.page.getByText(/Element clicked in the menu:/)).toBeVisible();

    await closeRootModal(app.page);
});

test('should open Sample Confirmation Dialog from team dropdown and respond to Confirm and Cancel', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Open team dropdown and click "Sample Confirmation Dialog"
    await app.lhs.header.openTeamMenuButton.click();
    await expect(app.lhs.teamMenu).toBeVisible();
    await expect(app.page.getByRole('menuitem', {name: 'Sample Confirmation Dialog'})).toBeVisible();
    await app.page.getByRole('menuitem', {name: 'Sample Confirmation Dialog'}).click();
    await expect(app.page.getByRole('menuitem', {name: 'Sample Confirmation Dialog'})).not.toBeVisible();

    // * Verify dialog opens with title and action buttons but no form fields
    const dialog = app.page.getByRole('dialog', {name: 'Sample Confirmation Dialog'});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {name: 'Sample Confirmation Dialog', level: 1})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toBeVisible();

    // # Click Confirm
    await dialog.getByRole('button', {name: 'Confirm'}).click();

    // * Verify the dialog closes and a confirmation post appears
    await expect(dialog).not.toBeVisible();
    await expect(await app.center.postList.postList.itemWith({text: 'confirmed an Interactive Dialog'})).toBeVisible();

    // # Reopen the dialog from the team dropdown and click Cancel
    await app.lhs.header.openTeamMenuButton.click();
    await expect(app.lhs.teamMenu).toBeVisible();
    await app.page.getByRole('menuitem', {name: 'Sample Confirmation Dialog'}).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', {name: 'Cancel'}).click();

    // * Verify the dialog closes and a cancellation post appears
    await expect(dialog).not.toBeVisible();
    await expect(await app.center.postList.postList.itemWith({text: 'canceled an Interactive Dialog'})).toBeVisible();
});
