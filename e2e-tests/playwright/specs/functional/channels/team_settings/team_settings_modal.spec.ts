// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Complete E2E test suite for Team Settings Modal
 * @reference MM-65975 - Migrate Team Settings Modal to GenericModal
 */

import path from 'path';

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

// Asset file path for team icon uploads
const TEAM_ICON_ASSET = path.resolve(__dirname, '../../../../lib/src/asset/mattermost-icon_128x128.png');

test.describe('Team Settings Modal - Complete Test Suite', () => {
    /**
     * MM-TXXXX: Open and close Team Settings Modal
     * @objective Verify basic modal open/close functionality
     */
    test('MM-TXXXX Open and close Team Settings Modal', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to a team
        await channelsPage.goto();
        await page.waitForLoadState('networkidle');

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
     * MM-TXXXX: Edit team name and save changes
     * @objective Verify team name can be edited and saved
     */
    test('MM-TXXXX Edit team name and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify current team name is displayed
        await expect(teamSettings.infoSettings.nameInput).toHaveValue(team.display_name);

        // # Edit team name
        const newTeamName = `Updated Team ${await pw.random.id()}`;
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
     * MM-TXXXX: Edit team description and save changes
     * @objective Verify team description can be edited and saved
     */
    test('MM-TXXXX Edit team description and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team description
        const newDescription = `Test description ${await pw.random.id()}`;
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
     * MM-TXXXX: Warn on close with unsaved changes
     * @objective Verify unsaved changes warning behavior (warn-once pattern)
     */
    test('MM-TXXXX Warn on close with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team name to create unsaved changes
        const newTeamName = `Modified Team ${await pw.random.id()}`;
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
     * MM-TXXXX: Prevent tab switch with unsaved changes
     * @objective Verify tab switching blocked with unsaved changes
     */
    test('MM-TXXXX Prevent tab switch with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify Access tab is visible (admin has INVITE_USER permission)
        await expect(teamSettings.accessTab).toBeVisible();

        // # Edit team name in Info tab (create unsaved changes)
        const newTeamName = `Modified Team ${await pw.random.id()}`;
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
     * MM-TXXXX: Save changes and close modal without warning
     * @objective Verify that after saving, modal closes without warning
     */
    test('MM-TXXXX Save changes and close modal without warning', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team name
        const newTeamName = `Updated Team ${await pw.random.id()}`;
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
     * MM-TXXXX: Undo changes resets form state
     * @objective Verify Undo button restores original values
     */
    test('MM-TXXXX Undo changes resets form state', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Edit team name
        const newTeamName = `Modified Team ${await pw.random.id()}`;
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

    /**
     * MM-TXXXX: Upload and Remove team icon
     * @objective Verify team icon can be uploaded and removed
     */
    test('MM-TXXXX Upload and Remove team icon', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();
        const infoSettings = teamSettings.infoSettings;

        // # Upload team icon using asset file
        await infoSettings.uploadIcon(TEAM_ICON_ASSET);

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

    /**
     * MM-TXXXX: Access tab - add and remove allowed domain
     * @objective Verify allowed domains can be added and removed
     */
    test('MM-TXXXX Access tab - add and remove allowed domain', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Switch to Access tab
        const accessSettings = await teamSettings.openAccessTab();

        // * Verify Access tab is active
        await expect(teamSettings.accessTab).toHaveAttribute('aria-selected', 'true');

        // # Enable allowed domains checkbox to show the input
        await accessSettings.enableAllowedDomains();

        // # Add an allowed domain
        const testDomain = 'testdomain.com';
        await accessSettings.addDomain(testDomain);

        // * Verify domain appears in the UI
        const domainChip = teamSettings.container.locator('#allowedDomains').getByText(testDomain);
        await expect(domainChip).toBeVisible();

        // # Save changes
        await teamSettings.save();

        // * Wait for "Settings saved" message
        await teamSettings.verifySavedMessage();

        // * Verify domain was saved via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allowed_domains).toContain(testDomain);

        // # Remove the added domain
        await accessSettings.removeDomain(testDomain);

        // # Save changes
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

        // * Verify domain was removed via API
        const finalTeam = await adminClient.getTeam(team.id);
        expect(finalTeam.allowed_domains).not.toContain(testDomain);

        // # Close modal
        await teamSettings.close();
    });

    /**
     * MM-TXXXX: Access tab - toggle allow open invite
     * @objective Verify "Users on this server" setting can be toggled on/off
     */
    test('MM-TXXXX Access tab - toggle allow open invite', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // Get original allow_open_invite state
        const originalTeam = await adminClient.getTeam(team.id);
        const originalAllowOpenInvite = originalTeam.allow_open_invite ?? false;

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Switch to Access tab
        const accessSettings = await teamSettings.openAccessTab();

        // * Verify Access tab is active
        await expect(teamSettings.accessTab).toHaveAttribute('aria-selected', 'true');

        // # Toggle allow open invite checkbox
        await accessSettings.toggleOpenInvite();

        // * Verify Save panel appears
        await expect(teamSettings.saveButton).toBeVisible();

        // # Save changes
        await teamSettings.save();

        // * Wait for "Settings saved" message
        await teamSettings.verifySavedMessage();

        // * Verify setting toggled via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(!originalAllowOpenInvite);

        // # Toggle back to original state
        await accessSettings.toggleOpenInvite();

        // # Save changes
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

        // * Verify reverted to original state via API
        const finalTeam = await adminClient.getTeam(team.id);
        expect(finalTeam.allow_open_invite).toBe(originalAllowOpenInvite);

        // # Close modal
        await teamSettings.close();
    });

    /**
     * MM-TXXXX: Access tab - regenerate invite ID
     * @objective Verify team invite ID can be regenerated
     */
    test('MM-TXXXX Access tab - regenerate invite ID', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // Get original invite ID
        const originalInviteId = team.invite_id;

        // # Navigate to team
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        const teamSettings = await channelsPage.openTeamSettings();

        // # Switch to Access tab
        const accessSettings = await teamSettings.openAccessTab();

        // * Verify Access tab is active
        await expect(teamSettings.accessTab).toHaveAttribute('aria-selected', 'true');

        // # Click regenerate button
        await accessSettings.regenerateInviteId();

        // * Verify invite ID changed via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.invite_id).not.toBe(originalInviteId);
        expect(updatedTeam.invite_id).toBeTruthy();

        // # Close modal
        await teamSettings.close();
    });
});
