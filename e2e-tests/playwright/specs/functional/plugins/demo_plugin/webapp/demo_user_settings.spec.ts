// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../helpers';

test('should show demo plugin settings sections and save changes with alert confirmation', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Open Settings via the library method
    const settingsModal = await channelsPage.openSettings();

    // 4. Navigate to the Demo Plugin settings tab
    await expect(settingsModal.container.getByText('PLUGIN PREFERENCES')).toBeVisible();
    await settingsModal.container.getByRole('tab', {name: /Demo Plugin/i}).click();

    // 5. Verify Demo Plugin Settings panel and all four section titles
    await expect(settingsModal.container.getByRole('heading', {name: 'Demo Plugin Settings', level: 3})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Example action', level: 4})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Test section number 1', level: 4})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Test section number 2', level: 4})).toBeVisible();
    await expect(settingsModal.container.getByRole('heading', {name: 'Test section disabled', level: 4})).toBeVisible();

    // 6. Verify Example action section has its button
    await expect(settingsModal.container.getByRole('button', {name: 'Here is the button text'})).toBeVisible();

    // 7. Verify Edit buttons visible for active sections (disabled section has none)
    const editButtons = settingsModal.container.locator('.section-min__edit');
    await expect(editButtons).toHaveCount(2);

    // 8. Expand Section 1, select Option 2, save
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
    expect(alerts[0]).toBe('saving {setting1}: 2');

    // 9. Expand Section 2, select Option 1, save
    await editButtons.nth(1).click();
    await settingsModal.container.getByRole('radio', {name: 'Option 1'}).first().click();
    await channelsPage.page.getByTestId('saveSetting').click();
    expect(alerts[1]).toBe('saving {setting3}: 1');

    channelsPage.page.off('dialog', dialogHandler);
});
