// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Unsaved Changes clearing (save / undo)
 * @reference MM-67920
 */

import {expect, test} from '@mattermost/playwright-lib';

import {loginAndOpenTeamSettings} from './support';

test.describe('Team Settings Modal - Unsaved Changes', () => {
    /**
     * MM-67920 Save changes and close modal without warning
     * @objective Verify that after saving, modal closes without warning
     */
    test('MM-67920 Save changes and close modal without warning', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();

        // # Navigate to team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);

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

        // # Navigate to team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);

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
