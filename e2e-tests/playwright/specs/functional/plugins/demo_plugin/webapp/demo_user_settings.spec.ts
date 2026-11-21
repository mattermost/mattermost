// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {demoPluginId, expect, test} from '@mattermost/playwright-lib';

test('should show demo plugin settings sections and save changes with alert confirmation', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Open Settings
    await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
    const settingsModal = app.userSettingsModal;

    // The demo plugin's settings panel renders inside the modal but is not part of the scanned webapp, so its
    // content is addressed by role within the modal.
    const pluginPanel = settingsModal.container.locator;
    const sections = settingsModal.settings.pluginPanel(demoPluginId).sectionList;

    // # Navigate to the Demo Plugin settings tab
    await expect(pluginPanel.getByText('PLUGIN PREFERENCES')).toBeVisible();
    const demoTab = pluginPanel.getByRole('tab', {name: /Demo Plugin/i});
    await demoTab.click();
    await expect(demoTab).toHaveAttribute('aria-selected', 'true');

    // * Verify Demo Plugin Settings panel and all four section titles
    await expect(pluginPanel.getByRole('heading', {name: 'Demo Plugin Settings', level: 3})).toBeVisible();
    await expect(pluginPanel.getByText('Example action', {exact: true})).toBeVisible();
    await expect(pluginPanel.getByRole('heading', {name: 'Test section number 1', level: 4})).toBeVisible();
    await expect(pluginPanel.getByRole('heading', {name: 'Test section number 2', level: 4})).toBeVisible();
    await expect(pluginPanel.getByRole('heading', {name: 'Test section disabled', level: 4})).toBeVisible();

    // * Verify Example action section has its button
    await expect(pluginPanel.getByRole('button', {name: 'Here is the button text'})).toBeVisible();

    // * Verify Edit buttons visible for active sections (disabled section has none)
    const editButtons = pluginPanel.locator('.section-min__edit');
    await expect(editButtons).toHaveCount(2);

    // # Expand Section 1, select Option 2, save
    // page.on captures the synchronous alert() that fires during Save click
    const alerts: string[] = [];
    const dialogHandler = async (dialog: {message: () => string; accept: () => Promise<void>}) => {
        alerts.push(dialog.message());
        await dialog.accept();
    };
    app.page.on('dialog', dialogHandler);

    await editButtons.first().click();
    const option2 = pluginPanel.getByRole('radio', {name: 'Option 2'}).first();
    await expect(option2).toBeVisible();
    await option2.click();
    await expect(option2).toBeChecked();
    await (await sections.itemWith({text: 'Test section number 1'})).saveButton.click();
    await expect.poll(() => alerts.length).toBe(1);

    // * Verify the save alert fired with the expected message
    expect(alerts[0]).toBe('saving {setting1}: 2');

    // # Expand Section 2, select Option 1, save
    await editButtons.nth(1).click();
    const option1 = pluginPanel.getByRole('radio', {name: 'Option 1'}).first();
    await expect(option1).toBeVisible();
    await option1.click();
    await expect(option1).toBeChecked();
    await (await sections.itemWith({text: 'Test section number 2'})).saveButton.click();
    await expect.poll(() => alerts.length).toBe(2);

    // * Verify the save alert fired with the expected message
    expect(alerts[1]).toBe('saving {setting3}: 1');

    app.page.off('dialog', dialogHandler);
});
