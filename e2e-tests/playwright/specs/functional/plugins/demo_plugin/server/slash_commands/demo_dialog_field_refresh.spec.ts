// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 2; attempt++) {
        await channelsPage.centerView.postCreate.input.fill('/dialog field-refresh');
        await channelsPage.centerView.postCreate.sendMessage();
        try {
            // 5. Confirm dialog opens with title "Project Configuration"
            await expect(dialog).toBeVisible({timeout: 15000});
            break; // dialog appeared — proceed
        } catch (err) {
            if (attempt === 1) {
                throw err; // exhausted retries — let the error surface naturally
            }
            // attempt 0 timed out — retry the slash command once
        }
    }
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Project Configuration');

    // 6. Verify initial state — only Project Type dropdown visible
    await expect(dialog.getByText('Project Type *')).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Create Project'})).toBeVisible();
    await expect(dialog.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // 7. Select "Web Application" — new fields should appear
    // Click the react-select control (not the hidden input) to open the dropdown
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await channelsPage.page.getByRole('option', {name: 'Web Application'}).click();

    await expect(dialog.getByText('Frontend Framework *')).toBeVisible();
    await expect(dialog.getByText('Enable PWA')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // 8. Change to "Mobile Application" — fields update
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await channelsPage.page.getByRole('option', {name: 'Mobile Application'}).click();

    await expect(dialog.getByText('Platform *')).toBeVisible();
    await expect(dialog.getByText('Minimum OS Version *')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialog.getByText('Enable PWA')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // 9. Change to "API Service" — fields update again
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await channelsPage.page.getByRole('option', {name: 'API Service'}).click();

    await expect(dialog.getByText('API Type *')).toBeVisible();
    await expect(dialog.getByRole('radio', {name: 'REST API'})).toBeVisible();
    await expect(dialog.getByRole('radio', {name: 'GraphQL API'})).toBeVisible();
    await expect(dialog.getByRole('radio', {name: 'gRPC Service'})).toBeVisible();
    await expect(dialog.getByText('Database *')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('Minimum OS Version')).not.toBeVisible();

    // 10. Fill required fields and submit
    await dialog.getByPlaceholder('Enter project name...').fill('Test Project');
    await dialog.getByRole('radio', {name: 'REST API'}).click();

    // Select PostgreSQL from Database dropdown
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').last().click();
    await channelsPage.page.getByRole('option', {name: 'PostgreSQL'}).click();

    await dialog.getByRole('button', {name: 'Create Project'}).click();
    await expect(dialog).not.toBeVisible();

    // 11. Verify response post in the channel
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'api project: Test Project'}),
    ).toBeVisible();
});
