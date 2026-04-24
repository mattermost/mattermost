// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Info Tab team icon upload / remove
 * @reference MM-67920
 */

import {getAsset} from '@/asset';
import {expect, test} from '@mattermost/playwright-lib';

import {loginAndOpenTeamSettings} from './support';

test.describe('Team Settings Modal - Info Tab', () => {
    /**
     * MM-67920 Upload and Remove team icon
     * @see MM-T391 (legacy Zephyr ID)
     * @objective Verify team icon can be uploaded and removed
     */
    test('MM-67920 Upload and Remove team icon', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team} = await pw.initSetup();

        // # Navigate to team and open Team Settings Modal
        const {channelsPage, teamSettings} = await loginAndOpenTeamSettings(pw, adminUser, team.name);
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
