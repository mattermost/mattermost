// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {recoverDemoPlugin, sendDemoSlashCommand} from '../../helpers';

test('should update form fields dynamically when project type changes via /dialog field-refresh', async ({pw}) => {
    // The submit hook has been observed to stop responding for the rest of a CI worker's
    // run with no single confirmed trigger (see recoverDemoPlugin's doc comment). The retry
    // loop below forces a full plugin recovery cycle partway through, which is the one
    // action known to clear it, so give it a generous timeout to leave room for that cycle.
    test.setTimeout(duration.four_min);

    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /dialog field-refresh command (with retries if the plugin is transiently
    // unavailable, e.g. during a concurrent plugin_crash.spec.ts recovery cycle)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog field-refresh');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break; // dialog appeared — proceed
        } catch (err) {
            if (attempt === 3) {
                throw err; // exhausted retries — let the error surface naturally
            }
            // attempt timed out — retry the slash command
        }
    }

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
    await channelsPage.page.getByRole('option', {name: 'Web Application'}).click();

    // * Verify the new fields appear
    await expect(dialog.getByText('Frontend Framework *')).toBeVisible();
    await expect(dialog.getByText('Enable PWA')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Platform')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // # Change to "Mobile Application"
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await channelsPage.page.getByRole('option', {name: 'Mobile Application'}).click();

    // * Verify fields update
    await expect(dialog.getByText('Platform *')).toBeVisible();
    await expect(dialog.getByText('Minimum OS Version *')).toBeVisible();
    await expect(dialog.getByText('Project Name *')).toBeVisible();
    await expect(dialog.getByText('Frontend Framework')).not.toBeVisible();
    await expect(dialog.getByText('Enable PWA')).not.toBeVisible();
    await expect(dialog.getByText('API Type')).not.toBeVisible();

    // # Change to "API Service"
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').first().click();
    await channelsPage.page.getByRole('option', {name: 'API Service'}).click();

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
    await dialog.getByRole('radio', {name: 'REST API'}).click();

    // Select PostgreSQL from Database dropdown
    await dialog.locator('[class*="Select__control"], [class*="react-select__control"]').last().click();
    await channelsPage.page.getByRole('option', {name: 'PostgreSQL'}).click();

    // # Submit the dialog (with retries if the plugin is transiently unavailable, in which
    // case the submit request can fail silently and the dialog never closes — re-clicking
    // Create Project is safe since the filled-in fields are retained). If plain retries
    // don't clear it, force a full plugin recovery cycle once and keep retrying — see
    // recoverDemoPlugin's doc comment for why that is the one action known to help.
    for (let attempt = 0; attempt < 12; attempt++) {
        if (attempt === 6) {
            await recoverDemoPlugin(adminClient);
        }
        await dialog.getByRole('button', {name: 'Create Project'}).click();
        try {
            await expect(dialog).not.toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 11) {
                throw err;
            }
        }
    }

    // * Verify the dialog closed and the response post appears in the channel
    await expect(dialog).not.toBeVisible();
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'api project: Test Project'}),
    ).toBeVisible();
});
