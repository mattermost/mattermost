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
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 2; attempt++) {
        await channelsPage.centerView.postCreate.input.fill('/dialog field-refresh');
        await channelsPage.centerView.postCreate.sendMessage();
        try {
            // 5. Confirm dialog opens with title "Project Configuration"
            await expect(interactiveDialog.container).toBeVisible({timeout: 15000});
            break; // dialog appeared — proceed
        } catch (err) {
            if (attempt === 1) {
                throw err; // exhausted retries — let the error surface naturally
            }
            // attempt 0 timed out — retry the slash command once
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText('Project Configuration');

    // 6. Verify initial state — only Project Type dropdown visible
    await expect(interactiveDialog.container.getByText('Project Type *')).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Create Project'})).toBeVisible();
    await expect(interactiveDialog.container.getByText('Frontend Framework')).not.toBeVisible();
    await expect(interactiveDialog.container.getByText('Platform')).not.toBeVisible();
    await expect(interactiveDialog.container.getByText('API Type')).not.toBeVisible();

    // 7. Select "Web Application" — new fields should appear
    // Click the react-select control (not the hidden input) to open the dropdown
    await interactiveDialog.getSelectControl('first').click();
    await interactiveDialog.selectOption('Web Application');

    await expect(interactiveDialog.container.getByText('Frontend Framework *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Enable PWA')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Project Name *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Platform')).not.toBeVisible();
    await expect(interactiveDialog.container.getByText('API Type')).not.toBeVisible();

    // 8. Change to "Mobile Application" — fields update
    await interactiveDialog.getSelectControl('first').click();
    await interactiveDialog.selectOption('Mobile Application');

    await expect(interactiveDialog.container.getByText('Platform *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Minimum OS Version *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Project Name *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Frontend Framework')).not.toBeVisible();
    await expect(interactiveDialog.container.getByText('Enable PWA')).not.toBeVisible();
    await expect(interactiveDialog.container.getByText('API Type')).not.toBeVisible();

    // 9. Change to "API Service" — fields update again
    await interactiveDialog.getSelectControl('first').click();
    await interactiveDialog.selectOption('API Service');

    await expect(interactiveDialog.container.getByText('API Type *')).toBeVisible();
    await expect(interactiveDialog.container.getByRole('radio', {name: 'REST API'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('radio', {name: 'GraphQL API'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('radio', {name: 'gRPC Service'})).toBeVisible();
    await expect(interactiveDialog.container.getByText('Database *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Project Name *')).toBeVisible();
    await expect(interactiveDialog.container.getByText('Platform')).not.toBeVisible();
    await expect(interactiveDialog.container.getByText('Minimum OS Version')).not.toBeVisible();

    // 10. Fill required fields and submit
    await interactiveDialog.container.getByPlaceholder('Enter project name...').fill('Test Project');
    await interactiveDialog.container.getByRole('radio', {name: 'REST API'}).click();

    // Select PostgreSQL from Database dropdown
    await interactiveDialog.getSelectControl('last').click();
    await interactiveDialog.selectOption('PostgreSQL');

    await interactiveDialog.container.getByRole('button', {name: 'Create Project'}).click();
    await expect(interactiveDialog.container).not.toBeVisible();

    // 11. Verify response post in the channel
    await expect(channelsPage.centerView.getSystemMessage('api project: Test Project')).toBeVisible();
});
