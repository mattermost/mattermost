// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should update form fields dynamically when project type changes via /dialog field-refresh', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog field-refresh command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog field-refresh');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens with title "Project Configuration"
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Project Configuration');

    // * Verify initial state — only Project Type dropdown visible
    await expect(dialog.getByText('Project Type *')).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Create Project'})).toBeVisible();
    await expect(dialog.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // # Select "Web Application"
    // Click the react-select control (not the hidden input) to open the dropdown
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await expect(app.page.getByRole('option', {name: 'Web Application'})).toBeVisible();
    await app.page.getByRole('option', {name: 'Web Application'}).click();
    await expect(app.page.getByRole('option', {name: 'Web Application'})).not.toBeVisible();

    // * Verify the new fields appear
    await expect(dialog.getByText('Frontend Framework *')).toBeVisible();
    await expect(dialog.getByText('Enable PWA')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // # Change to "Mobile Application"
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await expect(app.page.getByRole('option', {name: 'Mobile Application'})).toBeVisible();
    await app.page.getByRole('option', {name: 'Mobile Application'}).click();
    await expect(app.page.getByRole('option', {name: 'Mobile Application'})).not.toBeVisible();

    // * Verify fields update
    await expect(dialog.getByText('Platform *')).toBeVisible();
    await expect(dialog.getByText('Minimum OS Version *')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialog.getByText('Enable PWA')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // # Change to "API Service"
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await expect(app.page.getByRole('option', {name: 'API Service'})).toBeVisible();
    await app.page.getByRole('option', {name: 'API Service'}).click();
    await expect(app.page.getByRole('option', {name: 'API Service'})).not.toBeVisible();

    // * Verify fields update again
    await expect(dialog.getByText('API Type *')).toBeVisible();
    await expect(dialog.getByRole('radio', {name: 'REST API'})).toBeVisible();
    await expect(dialog.getByRole('radio', {name: 'GraphQL API'})).toBeVisible();
    await expect(dialog.getByRole('radio', {name: 'gRPC Service'})).toBeVisible();
    await expect(dialog.getByText('Database *')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('Minimum OS Version')).not.toBeVisible();

    // # Fill required fields and submit
    await dialog.getByPlaceholder('Enter project name...').fill('Test Project');
    await expect(dialog.getByPlaceholder('Enter project name...')).toHaveValue('Test Project');
    await dialog.getByRole('radio', {name: 'REST API'}).click();
    await expect(dialog.getByRole('radio', {name: 'REST API'})).toBeChecked();

    // Select PostgreSQL from Database dropdown
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').last().click();
    await expect(app.page.getByRole('option', {name: 'PostgreSQL'})).toBeVisible();
    await app.page.getByRole('option', {name: 'PostgreSQL'}).click();
    await expect(app.page.getByRole('option', {name: 'PostgreSQL'})).not.toBeVisible();

    // # Submit the dialog
    await dialog.getByRole('button', {name: 'Create Project'}).click();

    // * Verify the dialog closed and the response post appears in the channel
    await expect(dialog).not.toBeVisible();
    await expect(await app.center.postList.postList.itemWith({text: 'api project: Test Project'})).toBeVisible();
});
