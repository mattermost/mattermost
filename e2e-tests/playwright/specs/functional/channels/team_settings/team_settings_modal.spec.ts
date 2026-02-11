// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Complete E2E test suite for Team Settings Modal
 * @reference MM-65975 - Migrate Team Settings Modal to GenericModal
 */

import path from 'path';

import {expect, test} from '@mattermost/playwright-lib';

import {
    openTeamSettingsModal,
    switchToTab,
    updateTeamName,
    updateTeamDescription,
    uploadTeamIcon,
    removeTeamIcon,
    addAllowedDomain,
    removeAllowedDomain,
    saveTeamSettings,
    cancelTeamSettings,
    closeTeamSettingsModal,
    verifyModalOpen,
    verifyModalClosed,
    verifyTeamData,
    verifyUnsavedChangesWarning,
    verifySavedMessage,
    verifyTabActive,
    verifyTabExists,
} from '../../../../lib/src/server';

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

        // # Navigate to a team
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // * Verify modal opens with correct title
        const isOpen = await verifyModalOpen(page);
        expect(isOpen).toBe(true);

        // * Verify Info tab is selected by default
        const infoTabActive = await verifyTabActive(page, 'info');
        expect(infoTabActive).toBe(true);

        // # Close modal
        await closeTeamSettingsModal(page);

        // * Verify modal closes
        const isClosed = await verifyModalClosed(page);
        expect(isClosed).toBe(true);
    });

    /**
     * MM-TXXXX: Edit team name and save changes
     * @objective Verify team name can be edited and saved
     */
    test('MM-TXXXX Edit team name and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // Store original team name for cleanup
        const originalTeamName = team.display_name;

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // * Verify current team name is displayed
        const nameInput = page.locator('input#teamName');
        await expect(nameInput).toHaveValue(originalTeamName);

        // # Edit team name
        const newTeamName = `Updated Team ${await pw.random.id()}`;
        await updateTeamName(page, newTeamName);

        // # Save changes
        await saveTeamSettings(page);

        // * Wait for "Settings saved" message
        await verifySavedMessage(page);

        // * Verify team name updated via API
        await verifyTeamData(adminClient, team.id, {
            display_name: newTeamName,
        });

        // # Close modal
        await closeTeamSettingsModal(page);

        // * Verify modal closes without warning
        const isClosed = await verifyModalClosed(page);
        expect(isClosed).toBe(true);
    });

    /**
     * MM-TXXXX: Edit team description and save changes
     * @objective Verify team description can be edited and saved
     */
    test('MM-TXXXX Edit team description and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Edit team description
        const newDescription = `Test description ${await pw.random.id()}`;
        await updateTeamDescription(page, newDescription);

        // # Save changes
        await saveTeamSettings(page);

        // * Wait for "Settings saved" message
        await verifySavedMessage(page);

        // * Verify description updated via API
        await verifyTeamData(adminClient, team.id, {
            description: newDescription,
        });

        // # Close modal
        await closeTeamSettingsModal(page);

        // * Verify modal closes
        const isClosed = await verifyModalClosed(page);
        expect(isClosed).toBe(true);
    });

    /**
     * MM-TXXXX: Warn on close with unsaved changes
     * @objective Verify unsaved changes warning behavior (warn-once pattern)
     */
    test('MM-TXXXX Warn on close with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Edit team name to create unsaved changes
        const newTeamName = `Modified Team ${await pw.random.id()}`;
        await updateTeamName(page, newTeamName);

        // # Try to close modal (first attempt)
        await closeTeamSettingsModal(page);

        // * Verify "You have unsaved changes" warning appears
        const hasWarning = await verifyUnsavedChangesWarning(page);
        expect(hasWarning).toBe(true);

        // * Verify Save button is visible
        const saveButton = page.getByRole('button', {name: 'Save'});
        await expect(saveButton).toBeVisible();

        // * Verify modal is still open
        const isOpen = await verifyModalOpen(page);
        expect(isOpen).toBe(true);

        // # Try to close modal again (second attempt - warn-once behavior)
        await closeTeamSettingsModal(page);

        // * Verify modal closes on second attempt
        const isClosed = await verifyModalClosed(page);
        expect(isClosed).toBe(true);
    });

    /**
     * MM-TXXXX: Prevent tab switch with unsaved changes
     * @objective Verify tab switching blocked with unsaved changes
     */
    test('MM-TXXXX Prevent tab switch with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // * Verify both tabs are visible (admin has INVITE_USER permission)
        const accessTabExists = await verifyTabExists(page, 'access');
        expect(accessTabExists).toBe(true);

        // # Edit team name in Info tab (create unsaved changes)
        const newTeamName = `Modified Team ${await pw.random.id()}`;
        await updateTeamName(page, newTeamName);

        // # Try to switch to Access tab
        await switchToTab(page, 'access');

        // * Verify "You have unsaved changes" error appears
        const hasWarning = await verifyUnsavedChangesWarning(page);
        expect(hasWarning).toBe(true);

        // * Verify still on Info tab
        const infoTabActive = await verifyTabActive(page, 'info');
        expect(infoTabActive).toBe(true);

        // # Click Undo button
        await cancelTeamSettings(page);

        // * Verify can now switch to Access tab
        await switchToTab(page, 'access');
        const accessTabActive = await verifyTabActive(page, 'access');
        expect(accessTabActive).toBe(true);
    });

    /**
     * MM-TXXXX: Save changes and close modal without warning
     * @objective Verify that after saving, modal closes without warning
     */
    test('MM-TXXXX Save changes and close modal without warning', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Edit team name
        const newTeamName = `Updated Team ${await pw.random.id()}`;
        await updateTeamName(page, newTeamName);

        // # Save changes
        await saveTeamSettings(page);

        // * Wait for "Settings saved" message
        await verifySavedMessage(page);

        // * Verify team name updated via API
        await verifyTeamData(adminClient, team.id, {
            display_name: newTeamName,
        });

        // # Close modal immediately after save (should work without warning)
        await closeTeamSettingsModal(page);

        // * Verify modal closes without warning
        const isClosed = await verifyModalClosed(page);
        expect(isClosed).toBe(true);
    });

    /**
     * MM-TXXXX: Undo changes resets form state
     * @objective Verify Undo button restores original values
     */
    test('MM-TXXXX Undo changes resets form state', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        const originalTeamName = team.display_name;

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Edit team name
        const newTeamName = `Modified Team ${await pw.random.id()}`;
        await updateTeamName(page, newTeamName);

        // * Verify input shows new value
        const nameInput = page.locator('input#teamName');
        await expect(nameInput).toHaveValue(newTeamName);

        // # Click Undo button
        await cancelTeamSettings(page);

        // * Verify input restored to original value
        await expect(nameInput).toHaveValue(originalTeamName);

        // * Verify can close modal without warning
        await closeTeamSettingsModal(page);
        const isClosed = await verifyModalClosed(page);
        expect(isClosed).toBe(true);
    });

    /**
     * MM-TXXXX: Upload and Remove team icon
     * @objective Verify team icon can be removed
     */
    test('MM-TXXXX Upload and Remove team icon', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Upload team icon using asset file
        await uploadTeamIcon(page, TEAM_ICON_ASSET);
        await page.waitForTimeout(2000);

        // * Verify upload preview shows (as div with background-image before save)
        const teamIconImage = page.locator('#teamIconImage');
        await expect(teamIconImage).toBeVisible();

        // * Verify remove button appears
        const removeButton = page.locator('button[data-testid="removeImageButton"]');
        await expect(removeButton).toBeVisible();

        // # Save changes
        await saveTeamSettings(page);
        await verifySavedMessage(page);

        // * Get team data after upload to verify icon exists via API
        await page.waitForTimeout(1000);
        const teamWithIcon = await adminClient.getTeam(team.id);
        expect(teamWithIcon.last_team_icon_update).toBeGreaterThan(0);

        // # Close and reopen modal to verify persistence
        await closeTeamSettingsModal(page);
        await page.waitForTimeout(1000);
        await openTeamSettingsModal(page);

        // * Verify uploaded icon persists after reopening modal (now as img tag)
        const persistedIcon = page.locator('#teamIconImage');
        await expect(persistedIcon).toBeVisible();
        await expect(removeButton).toBeVisible();

        // # Remove the icon (this removes it immediately without save)
        await removeTeamIcon(page);

        // * Wait for removal to process
        await page.waitForTimeout(2000);

        // * Verify icon was removed - check for default icon initials in modal
        const teamIconInitial = page.locator('#teamIconInitial');
        await expect(teamIconInitial).toBeVisible();

        // * Verify icon was removed via API (last_team_icon_update should be 0 or undefined)
        const teamAfterRemove = await adminClient.getTeam(team.id);
        expect(teamAfterRemove.last_team_icon_update || 0).toBe(0);

        // # Close modal
        await closeTeamSettingsModal(page);
    });

    /**
     * Access tab - add and remove allowed domain
     * @objective Verify allowed domains can be added and removed
     */
    test('MM-TXXXX Access tab - add and remove allowed domain', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Switch to Access tab
        await switchToTab(page, 'access');

        // * Verify Access tab is active
        const accessTabActive = await verifyTabActive(page, 'access');
        expect(accessTabActive).toBe(true);

        // # Enable allowed domains checkbox to show the input
        const allowedDomainsCheckbox = page.locator('input[name="showAllowedDomains"]');
        await allowedDomainsCheckbox.check();
        await page.waitForTimeout(500);

        // # Add an allowed domain
        const testDomain = 'testdomain.com';
        await addAllowedDomain(page, testDomain);
        await page.waitForTimeout(500);

        // * Verify domain appears in the UI
        const domainChip = page.locator('#allowedDomains').getByText(testDomain);
        await expect(domainChip).toBeVisible();

        // # Save changes
        await saveTeamSettings(page);

        // * Wait for "Settings saved" message
        await verifySavedMessage(page);

        // * Verify domain was saved via API
        await page.waitForTimeout(1000);
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allowed_domains).toContain(testDomain);

        // # Remove the added domain
        await removeAllowedDomain(page, testDomain);
        await page.waitForTimeout(500);

        // # Save changes
        await saveTeamSettings(page);
        await verifySavedMessage(page);

        // * Verify domain was removed via API
        await page.waitForTimeout(1000);
        const finalTeam = await adminClient.getTeam(team.id);
        expect(finalTeam.allowed_domains).not.toContain(testDomain);

        // # Close modal
        await closeTeamSettingsModal(page);
    });

    /**
     * MM-TXXXX: Access tab - toggle allow open invite
     * @objective Verify "Users on this server" setting can be toggled on/off
     */
    test('MM-TXXXX Access tab - toggle allow open invite', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // Get original allow_open_invite state
        const originalTeam = await adminClient.getTeam(team.id);
        const originalAllowOpenInvite = originalTeam.allow_open_invite ?? false;

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Switch to Access tab
        await switchToTab(page, 'access');

        // * Verify Access tab is active
        const accessTabActive = await verifyTabActive(page, 'access');
        expect(accessTabActive).toBe(true);

        // # Toggle allow open invite checkbox
        const allowOpenInviteCheckbox = page.locator('input[name="allowOpenInvite"]');
        await allowOpenInviteCheckbox.click();
        await page.waitForTimeout(500);

        // * Verify Save panel appears
        const saveButton = page.locator('button[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveButton).toBeVisible();

        // # Save changes
        await saveTeamSettings(page);

        // * Wait for "Settings saved" message
        await verifySavedMessage(page);

        // * Verify setting toggled via API
        await page.waitForTimeout(1000);
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(!originalAllowOpenInvite);

        // # Toggle back to original state
        await allowOpenInviteCheckbox.click();
        await page.waitForTimeout(500);

        // # Save changes
        await saveTeamSettings(page);
        await verifySavedMessage(page);

        // * Verify reverted to original state via API
        await page.waitForTimeout(1000);
        const finalTeam = await adminClient.getTeam(team.id);
        expect(finalTeam.allow_open_invite).toBe(originalAllowOpenInvite);

        // # Close modal
        await closeTeamSettingsModal(page);
    });

    /**
     * MM-TXXXX: Access tab - regenerate invite ID
     * @objective Verify team invite ID can be regenerated
     */
    test('MM-TXXXX Access tab - regenerate invite ID', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {page} = await pw.testBrowser.login(adminUser);

        // Get original invite ID
        const originalInviteId = team.invite_id;

        // # Navigate to team
        await page.goto(`/${team.name}`);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings Modal
        await openTeamSettingsModal(page);

        // # Switch to Access tab
        await switchToTab(page, 'access');

        // * Verify Access tab is active
        const accessTabActive = await verifyTabActive(page, 'access');
        expect(accessTabActive).toBe(true);

        // # Click regenerate button
        const regenerateButton = page.locator('button[data-testid="regenerateButton"]');
        await regenerateButton.click();
        await page.waitForTimeout(1000);

        // * Verify invite ID changed via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.invite_id).not.toBe(originalInviteId);
        expect(updatedTeam.invite_id).toBeTruthy();

        // # Close modal
        await closeTeamSettingsModal(page);
    });
});
