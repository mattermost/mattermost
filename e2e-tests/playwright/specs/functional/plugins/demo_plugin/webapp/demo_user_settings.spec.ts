// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should show demo plugin settings sections and save changes with alert confirmation', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open Settings via the library method
    const settingsModal = await channelsPage.openSettings();

    // # Navigate to the Demo Plugin settings tab
    await expect(settingsModal.container.getByText('PLUGIN PREFERENCES')).toBeVisible();
    await settingsModal.container.getByRole('tab', {name: /Demo Plugin/i}).click();

    // * Verify Demo Plugin Settings panel and all four section titles
    await expect(settingsModal.container.getByRole('heading', {name: 'Demo Plugin Settings', level: 3})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Example action', level: 4})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Test section number 1', level: 4})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Test section number 2', level: 4})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Test section disabled', level: 4})).toBeVisible();

    // * Verify Example action section has its button
    await expect(settingsModal.container.getByRole('button', {name: 'Here is the button text'})).toBeVisible();

    // * Verify Edit buttons visible for active sections (disabled section has none)
    const editButtons = settingsModal.container.locator('.section-min__edit');
    await expect(editButtons).toHaveCount(2);

    // # Expand Section 1, select Option 2, save
    // page.on captures the synchronous alert() that fires during Save click
    const alerts: string[] = [];
    const dialogHandler = async (dialog: {message: () => string; accept: () => Promise<void>}) => {
        alerts.push(dialog.message());
        await dialog.accept();
    };
    channelsPage.page.on('dialog', dialogHandler);

    await editButtons.first().click();
    await settingsModal.container.getByRole('radio', {name: 'Option 2'}).first().click();
    await channelsPage.page.getByTestId('saveSetting').click();

    // * Verify the save alert fired with the expected message
    expect(alerts[0]).toBe('saving {setting1}: 2');

    // # Expand Section 2, select Option 1, save
    await editButtons.nth(1).click();
    await settingsModal.container.getByRole('radio', {name: 'Option 1'}).first().click();
    await channelsPage.page.getByTestId('saveSetting').click();

    // * Verify the save alert fired with the expected message
    expect(alerts[1]).toBe('saving {setting3}: 1');

    channelsPage.page.off('dialog', dialogHandler);
});
