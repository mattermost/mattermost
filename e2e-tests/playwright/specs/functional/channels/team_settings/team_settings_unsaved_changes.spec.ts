// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Unsaved Changes behavior
 * @reference MM-67920
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

test.describe('Team Settings Modal - Unsaved Changes', () => {
    /**
     * MM-67920 Warn on close with unsaved changes
     * @objective Verify unsaved changes warning behavior (warn-once pattern)
     */
    test('MM-67920 Warn on close with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team name to create unsaved changes
        const newTeamName = `Modified Team ${pw.random.id()}`;
        await teamSettings.infoSettings.updateName(newTeamName);

        // # Try to close modal (first attempt)
        await teamSettings.close();

        // * Verify "You have unsaved changes" warning appears
        await teamSettings.verifyUnsavedChanges();

        // * Verify Save button is visible
        await expect(teamSettings.saveButton).toBeVisible();

        // * Verify modal is still open
        await expect(teamSettings.container).toBeVisible();

        // # Try to close modal again (second attempt - warn-once behavior)
        await teamSettings.close();

        // * Verify modal closes on second attempt
        await expect(teamSettings.container).not.toBeVisible();
    });

    /**
     * MM-67920 Prevent tab switch with unsaved changes
     * @objective Verify tab switching blocked with unsaved changes
     */
    test('MM-67920 Prevent tab switch with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify Access tab is visible (admin has INVITE_USER permission)
        await expect(teamSettings.accessTab).toBeVisible();

        // # Edit team name in Info tab (create unsaved changes)
        const newTeamName = `Modified Team ${pw.random.id()}`;
        await teamSettings.infoSettings.updateName(newTeamName);

        // # Try to switch to Access tab
        await teamSettings.openAccessTab();

        // * Verify "You have unsaved changes" error appears
        await teamSettings.verifyUnsavedChanges();

        // * Verify still on Info tab
        await expect(teamSettings.infoTab).toHaveAttribute('aria-selected', 'true');

        // # Click Undo button
        await teamSettings.undo();

        // * Verify can now switch to Access tab
        await teamSettings.openAccessTab();
        await expect(teamSettings.accessTab).toHaveAttribute('aria-selected', 'true');
    });

    /**
     * MM-67920 Save changes and close modal without warning
     * @objective Verify that after saving, modal closes without warning
     */
    test('MM-67920 Save changes and close modal without warning', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team name
        const newTeamName = `Updated Team ${pw.random.id()}`;
        await teamSettings.infoSettings.updateName(newTeamName);

        // # Save changes
        await teamSettings.save();

        // * Wait for "Settings saved" message
        await teamSettings.verifySavedMessage();

        // * Verify team name updated via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.display_name).toBe(newTeamName);

        // # Close modal immediately after save (should work without warning)
        await teamSettings.close();

        // * Verify modal closes without warning
        await expect(teamSettings.container).not.toBeVisible();
    });

    /**
     * MM-67920 Undo changes resets form state
     * @objective Verify Undo button restores original values
     */
    test('MM-67920 Undo changes resets form state', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team name
        const newTeamName = `Modified Team ${pw.random.id()}`;
        await teamSettings.infoSettings.updateName(newTeamName);

        // * Verify input shows new value
        await expect(teamSettings.infoSettings.nameInput).toHaveValue(newTeamName);

        // # Click Undo button
        await teamSettings.undo();

        // * Verify input restored to original value
        await expect(teamSettings.infoSettings.nameInput).toHaveValue(team.display_name);

        // * Verify can close modal without warning
        await teamSettings.close();
        await expect(teamSettings.container).not.toBeVisible();
    });
});
