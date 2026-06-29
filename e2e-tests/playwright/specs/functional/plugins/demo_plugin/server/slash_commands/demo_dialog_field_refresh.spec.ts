// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, PluginInteractiveDialog} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should update form fields dynamically when project type changes via /dialog field-refresh', async ({pw}) => {
    // Plugin installation can take up to 60 s; extend the test timeout to avoid
    // a premature timeout before the dialog even opens.
    test.setTimeout(120000);

    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog field-refresh command (with one retry if the dialog doesn't appear).
    // Re-apply guard: concurrent initSetup() resets PluginSettings (Plugins: {}) which
    // clears the demo plugin config; re-running setupDemoPlugin is fast when the plugin
    // is already active (alreadyActive guard skips reinstall).
    await setupDemoPlugin(adminClient, pw);
    const dialogLocator = channelsPage.page.getByRole('dialog');
    const pluginDialog = new PluginInteractiveDialog(dialogLocator);
    for (let attempt = 0; attempt < 2; attempt++) {
        await channelsPage.centerView.postCreate.input.fill('/dialog field-refresh');
        await channelsPage.centerView.postCreate.sendMessage();
        try {
            // 5. Confirm dialog opens with title "Project Configuration"
            await expect(dialogLocator).toBeVisible({timeout: 15000});
            break; // dialog appeared — proceed
        } catch (err) {
            if (attempt === 1) {
                throw err; // exhausted retries — let the error surface naturally
            }
            // attempt 0 timed out — retry the slash command once
        }
    }
    await expect(pluginDialog.title).toContainText('Project Configuration');

    // 6. Verify initial state — only Project Type dropdown visible
    await expect(dialogLocator.getByText('Project Type *')).toBeVisible();
    await expect(pluginDialog.cancelButton).toBeVisible();
    await expect(dialogLocator.getByRole('button', {name: 'Create Project'})).toBeVisible();
    await expect(dialogLocator.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialogLocator.getByText('Platform')).not.toBeVisible();
    await expect(dialogLocator.getByText('API Type')).not.toBeVisible();

    // 7. Select "Web Application" — new fields should appear
    // Click the react-select control (not the hidden input) to open the dropdown
    await dialogLocator.getByRole('combobox').first().click();
    await pluginDialog.getOption('Web Application').click();

    await expect(dialogLocator.getByText('Frontend Framework *')).toBeVisible();
    await expect(dialogLocator.getByText('Enable PWA')).toBeVisible();
    await expect(dialogLocator.getByText('Project Name *')).toBeVisible();
    await expect(dialogLocator.getByText('Platform')).not.toBeVisible();
    await expect(dialogLocator.getByText('API Type')).not.toBeVisible();

    // 8. Change to "Mobile Application" — fields update
    await dialogLocator.getByRole('combobox').first().click();
    await pluginDialog.getOption('Mobile Application').click();

    await expect(dialogLocator.getByText('Platform *')).toBeVisible();
    await expect(dialogLocator.getByText('Minimum OS Version *')).toBeVisible();
    await expect(dialogLocator.getByText('Project Name *')).toBeVisible();
    await expect(dialogLocator.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialogLocator.getByText('Enable PWA')).not.toBeVisible();
    await expect(dialogLocator.getByText('API Type')).not.toBeVisible();

    // 9. Change to "API Service" — fields update again
    await dialogLocator.getByRole('combobox').first().click();
    await pluginDialog.getOption('API Service').click();

    await expect(dialogLocator.getByText('API Type *')).toBeVisible();
    await expect(pluginDialog.radioOption('REST API')).toBeVisible();
    await expect(pluginDialog.radioOption('GraphQL API')).toBeVisible();
    await expect(pluginDialog.radioOption('gRPC Service')).toBeVisible();
    await expect(dialogLocator.getByText('Database *')).toBeVisible();
    await expect(dialogLocator.getByText('Project Name *')).toBeVisible();
    await expect(dialogLocator.getByText('Platform')).not.toBeVisible();
    await expect(dialogLocator.getByText('Minimum OS Version')).not.toBeVisible();

    // 10. Fill required fields and submit
    await dialogLocator.getByPlaceholder('Enter project name...').fill('Test Project');
    await pluginDialog.radioOption('REST API').click();

    // Select PostgreSQL from Database dropdown
    await dialogLocator.getByRole('combobox').last().click();
    await pluginDialog.getOption('PostgreSQL').click();

    await dialogLocator.getByRole('button', {name: 'Create Project'}).click();
    await expect(dialogLocator).not.toBeVisible();

    // 11. Verify response post in the channel
    await expect(channelsPage.centerView.container.getByText('api project: Test Project')).toBeVisible();
});
