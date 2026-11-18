// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the keyboard shortcuts modal opens from Ctrl/Cmd+/ and /shortcuts, displays the
 * platform-specific upload shortcut, and can be closed by the shortcut, its close button, or Escape.
 */
test('MM-T1239 CTRL/CMD+/ and /shortcuts open keyboard shortcuts', async ({pw}) => {
    const {user, team, townSquare} = await pw.initSetup();

    // # Open the keyboard shortcuts modal with the shortcut
    const {page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    await app.center.postCreate.message.container.focus();
    await page.keyboard.press('ControlOrMeta+/');

    // * Verify the shortcuts modal opens and shows the platform-specific "Upload files" shortcut
    // The shortcut dialog declares no scope here, so it is found by its accessible name.
    const modal = app.page.getByRole('dialog', {name: /Keyboard shortcuts/});
    await expect(modal).toBeVisible();
    const filesSection = modal.locator('.subsection').filter({hasText: 'Files'});
    await expect(filesSection).toBeVisible();
    await expect(filesSection.getByText(process.platform === 'darwin' ? '⌘' : 'Ctrl')).toBeVisible();
    await expect(filesSection.getByText('U', {exact: true})).toBeVisible();

    // # Close the modal by pressing the same shortcut again
    await page.keyboard.press('ControlOrMeta+/');
    await expect(modal).not.toBeVisible();

    // # Reopen via the slash command and close using the modal's close button
    await app.center.postCreate.message.container.fill('/shortcuts');
    await app.center.postCreate.sendButton.click();
    await expect(modal).toBeVisible();
    await modal.getByRole('button', {name: 'Close'}).click();
    await expect(modal).not.toBeVisible();

    // # Reopen via the slash command and close by pressing Escape
    await app.center.postCreate.message.container.fill('/shortcuts');
    await app.center.postCreate.sendButton.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
});

/**
 * @objective Verify Ctrl/Cmd+K channel switch keeps focus so typed characters are not lost.
 */
test('MM-T1242 CTRL/CMD+K typed characters are not lost after switching channels', async ({pw}) => {
    const {user, team, offTopic, townSquare} = await pw.initSetup();
    const message = 'Hello World!';

    // # Open quick switcher, select the current channel, and type into the focused page
    const {page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    await app.center.postCreate.message.container.focus();
    await page.keyboard.press('ControlOrMeta+K');
    await expect(app.quickSwitchModal.searchTextbox).toBeVisible();
    await app.quickSwitchModal.searchTextbox.fill('off');
    await app.quickSwitchModal.suggestions.suggestion(offTopic.id).select();
    await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');
    await page.keyboard.type(message);

    // * Verify typed characters land in the post textbox
    await expect(app.center.postCreate.message.container).toHaveValue(message);
});
