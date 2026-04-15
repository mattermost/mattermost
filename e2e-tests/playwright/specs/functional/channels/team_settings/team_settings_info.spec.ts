// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Info Tab
 * @reference MM-67920
 */

import {getAsset} from '@/asset';
import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

test.describe('Team Settings Modal - Info Tab', () => {
    /**
     * MM-67920 Open and close Team Settings Modal
     * @objective Verify basic modal open/close functionality
     */
    test('MM-67920 Open and close Team Settings Modal', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to a team
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify Info tab is selected by default
        await expect(teamSettings.infoTab).toHaveAttribute('aria-selected', 'true');

        // # Close modal
        await teamSettings.close();

        // * Verify modal closes
        await expect(teamSettings.container).not.toBeVisible();
    });

    /**
     * MM-67920 Edit team name and save changes
     * @objective Verify team name can be edited and saved
     */
    test('MM-67920 Edit team name and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify current team name is displayed
        await expect(teamSettings.infoSettings.nameInput).toHaveValue(team.display_name);

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

        // # Close modal
        await teamSettings.close();

        // * Verify modal closes without warning
        await expect(teamSettings.container).not.toBeVisible();
    });

    /**
     * MM-67920 Edit team description and save changes
     * @objective Verify team description can be edited and saved
     */
    test('MM-67920 Edit team description and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team description
        const newDescription = `Test description ${pw.random.id()}`;
        await teamSettings.infoSettings.updateDescription(newDescription);

        // # Save changes
        await teamSettings.save();

        // * Wait for "Settings saved" message
        await teamSettings.verifySavedMessage();

        // * Verify description updated via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.description).toBe(newDescription);

        // # Close modal
        await teamSettings.close();

        // * Verify modal closes
        await expect(teamSettings.container).not.toBeVisible();
    });

    /**
     * MM-67920 Upload and Remove team icon
     * @see MM-T391 (legacy Zephyr ID)
     * @objective Verify team icon can be uploaded and removed
     */
    test('MM-67920 Upload and Remove team icon', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();
        const infoSettings = teamSettings.infoSettings;

        // # Upload team icon using asset file
        await infoSettings.uploadIcon(getAsset('mattermost-icon_128x128.png'));

        // * Verify upload preview shows
        await expect(infoSettings.teamIconImage).toBeVisible();

        // * Verify remove button appears
        await expect(infoSettings.removeImageButton).toBeVisible();

        // # Save changes
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

        // * Get team data after upload to verify icon exists via API
        const teamWithIcon = await adminClient.getTeam(team.id);
        expect(teamWithIcon.last_team_icon_update).toBeGreaterThan(0);

        // # Close and reopen modal to verify persistence
        await teamSettings.close();
        await expect(teamSettings.container).not.toBeVisible();
        const teamSettings2 = await channelsPage.openTeamSettings();

        // * Verify uploaded icon persists after reopening modal
        await expect(teamSettings2.infoSettings.teamIconImage).toBeVisible();
        await expect(teamSettings2.infoSettings.removeImageButton).toBeVisible();

        // # Remove the icon
        await teamSettings2.infoSettings.removeIcon();

        // * Verify icon was removed - check for default icon initials in modal
        await expect(teamSettings2.infoSettings.teamIconInitial).toBeVisible();

        // * Verify icon was removed via API
        const teamAfterRemove = await adminClient.getTeam(team.id);
        expect(teamAfterRemove.last_team_icon_update || 0).toBe(0);

        // # Close modal
        await teamSettings2.close();
    });
});
