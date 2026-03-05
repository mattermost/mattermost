// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, testConfig} from '@mattermost/playwright-lib';
import type {Command} from '@mattermost/types/commands';

const webhookBaseUrl = testConfig.webhookBaseUrl;

/**
 * Migrated from Cypress: simple_dialog_spec.js
 * Tests interactive dialog (Apps Form) without elements via slash command.
 * Requires webhook-test-server running.
 */
test.describe('Interactive Dialog - Simple dialog without elements', () => {
    let commandTrigger: string;
    let setupTeamName: string;
    let isSetupDone = false;

    async function ensureSetup(pw: any) {
        if (isSetupDone) {
            return;
        }

        // Health check webhook server
        const healthRes = await fetch(webhookBaseUrl);
        expect(healthRes.ok, `Webhook server at ${webhookBaseUrl} is not reachable`).toBeTruthy();

        const {adminClient, team} = await pw.initSetup();
        setupTeamName = team.name;

        // Setup webhook server with Mattermost connection details
        const setupRes = await fetch(`${webhookBaseUrl}/setup`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                baseUrl: testConfig.baseURL,
                webhookBaseUrl,
                adminUsername: testConfig.adminUsername,
                adminPassword: testConfig.adminPassword,
            }),
        });
        expect(setupRes.status).toBe(201);

        // Create slash command pointing to the webhook server's simple dialog endpoint
        const command = await adminClient.addCommand({
            auto_complete: false,
            description: 'Test for simple dialog - no element',
            display_name: 'Simple Dialog without element',
            icon_url: '',
            method: 'P',
            team_id: team.id,
            trigger: 'simple_dialog',
            url: `${webhookBaseUrl}/simple-dialog-request`,
            username: '',
        } as Command);
        commandTrigger = command.trigger;

        isSetupDone = true;
    }

    test('MM-T2500_1 UI check @interactive_dialog', {tag: '@interactive_dialog'}, async ({pw}) => {
        await ensureSetup(pw);

        const {user} = await pw.initSetup({teamsOptions: {name: setupTeamName, displayName: 'Team', type: 'O' as const, unique: false}});
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(setupTeamName, 'town-square');
        await channelsPage.toBeVisible();

        // Post the slash command to trigger the dialog
        await channelsPage.centerView.postCreate.postMessage(`/${commandTrigger} `);

        // Verify the apps form modal opens
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // Verify header: icon, title, close button
        const header = modal.locator('.modal-header');
        await expect(header).toBeVisible();
        await expect(header.locator('#appsModalIconUrl')).toBeVisible();
        await expect(header.locator('#appsModalLabel')).toHaveText('Title for Dialog Test without elements');
        await expect(header.locator('button.close')).toBeVisible();

        // Verify body exists but has no form fields
        await expect(modal.locator('.modal-body')).toBeVisible();
        await expect(modal.locator('.modal-body .form-group')).toHaveCount(0);

        // Verify footer: cancel and submit buttons
        const footer = modal.locator('.modal-footer');
        await expect(footer).toBeVisible();
        await expect(footer.locator('#appsModalCancel')).toHaveText('Cancel');
        await expect(footer.locator('#appsModalSubmit')).toHaveText('Submit Test');

        // Close the modal
        await header.locator('button.close').click();
        await expect(modal).not.toBeVisible();
    });

    test('MM-T2500_2 "X" closes the dialog @interactive_dialog', {tag: '@interactive_dialog'}, async ({pw}) => {
        await ensureSetup(pw);

        const {user} = await pw.initSetup({teamsOptions: {name: setupTeamName, displayName: 'Team', type: 'O' as const, unique: false}});
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(setupTeamName, 'town-square');
        await channelsPage.toBeVisible();

        // Post the slash command
        await channelsPage.centerView.postCreate.postMessage(`/${commandTrigger} `);

        // Verify modal is visible
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // Click "X" to close
        await modal.locator('.modal-header button.close').click();
        await expect(modal).not.toBeVisible();

        // Verify last post says dialog is cancelled
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).toContainText('Dialog cancelled');
    });

    test('MM-T2500_3 Cancel button works @interactive_dialog', {tag: '@interactive_dialog'}, async ({pw}) => {
        await ensureSetup(pw);

        const {user} = await pw.initSetup({teamsOptions: {name: setupTeamName, displayName: 'Team', type: 'O' as const, unique: false}});
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(setupTeamName, 'town-square');
        await channelsPage.toBeVisible();

        // Post the slash command
        await channelsPage.centerView.postCreate.postMessage(`/${commandTrigger} `);

        // Verify modal is visible
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // Click cancel
        await modal.locator('#appsModalCancel').click();
        await expect(modal).not.toBeVisible();

        // Verify last post says dialog is cancelled
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).toContainText('Dialog cancelled');
    });

    test('MM-T2500_4 Submit button works @interactive_dialog', {tag: ['@smoke', '@interactive_dialog']}, async ({pw}) => {
        await ensureSetup(pw);

        const {user} = await pw.initSetup({teamsOptions: {name: setupTeamName, displayName: 'Team', type: 'O' as const, unique: false}});
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(setupTeamName, 'town-square');
        await channelsPage.toBeVisible();

        // Post the slash command
        await channelsPage.centerView.postCreate.postMessage(`/${commandTrigger} `);

        // Verify modal is visible
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // Click submit
        await modal.locator('#appsModalSubmit').click();
        await expect(modal).not.toBeVisible();

        // Verify last post says dialog is submitted
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).toContainText('Dialog submitted');
    });
});
