// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Info Tab text-field flows (modal open/close, name, description)
 * @reference MM-67920
 */

import {expect, test} from '@mattermost/playwright-lib';

import {loginAndOpenTeamSettings} from './support';

test.describe('Team Settings Modal - Info Tab', () => {
    /**
     * MM-67920 Open and close Team Settings Modal
     * @objective Verify basic modal open/close functionality
     */
    test('MM-67920 Open and close Team Settings Modal', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser} = await pw.initSetup();

        // # Navigate to a team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser);

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

        // # Navigate to team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);

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

        // # Navigate to team and open Team Settings Modal
        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);

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
});
