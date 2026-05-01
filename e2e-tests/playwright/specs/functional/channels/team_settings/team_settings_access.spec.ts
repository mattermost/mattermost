// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Access Tab
 * @reference MM-67920
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

test.describe('Team Settings Modal - Access Tab', () => {
    /**
     * MM-67920 Access tab - add and remove allowed domain
     * @objective Verify allowed domains can be added and removed
     */
    test('MM-67920 Access tab - add and remove allowed domain', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

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
     * MM-67920 Access tab - toggle allow open invite
     * @objective Verify "Users on this server" setting can be toggled on/off
     */
    test('MM-67920 Access tab - toggle allow open invite', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // Get original allow_open_invite state
        const originalTeam = await adminClient.getTeam(team.id);
        const originalAllowOpenInvite = originalTeam.allow_open_invite ?? false;

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

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
     * MM-67920 Access tab - regenerate invite ID
     * @objective Verify team invite ID can be regenerated
     */
    test('MM-67920 Access tab - regenerate invite ID', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // Get original invite ID
        const originalInviteId = team.invite_id;

        // # Navigate to team
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

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
