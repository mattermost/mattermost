// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Unsaved Changes warnings (close / tab switch)
 * @reference MM-67920
 */

import {expect, test} from '@mattermost/playwright-lib';

import {loginAndOpenTeamSettings} from './support';

test.describe('Team Settings Modal - Unsaved Changes', () => {
    /**
     * MM-67920 Warn on close with unsaved changes
     * @objective Verify unsaved changes warning behavior (warn-once pattern)
     */
    test('MM-67920 Warn on close with unsaved changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team} = await pw.initSetup();

        // # Navigate to team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);

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

        // # Navigate to team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);

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
});
