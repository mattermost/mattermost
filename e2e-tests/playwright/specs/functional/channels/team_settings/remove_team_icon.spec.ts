// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAsset} from '@/asset';
import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

/**
 * MM-T391: Remove team icon
 * @objective Verify team icon can be uploaded, removed, and removal persists after reopening the modal
 */
test('MM-T391 Remove team icon', async ({pw}) => {
    // # Set up admin user and login
    const {adminUser, adminClient, team} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(adminUser);
    const channelsPage = new ChannelsPage(page);

    // # Navigate to team
    await channelsPage.goto(team.name);

    // # Open Team Settings Modal
    let teamSettings = await channelsPage.openTeamSettings();
    const infoSettings = teamSettings.infoSettings;

    // # Upload team icon via UI
    await infoSettings.uploadIcon(getAsset('mattermost-icon_128x128.png'));

    // # Save changes
    await teamSettings.save();
    await teamSettings.verifySavedMessage();

    // * Verify icon was set via API
    const teamWithIcon = await adminClient.getTeam(team.id);
    expect(teamWithIcon.last_team_icon_update).toBeGreaterThan(0);

    // # Close modal and wait for it to disappear
    await teamSettings.close();
    await expect(teamSettings.container).not.toBeVisible();

    // # Reopen Team Settings Modal
    teamSettings = await channelsPage.openTeamSettings();

    // * Verify team icon image is visible and initial is not
    await expect(infoSettings.teamIconImage).toBeVisible();
    await expect(infoSettings.teamIconInitial).not.toBeVisible();

    // # Click remove icon
    await infoSettings.removeIcon();

    // * Verify icon was removed via API
    const teamAfterRemove = await adminClient.getTeam(team.id);
    expect(teamAfterRemove.last_team_icon_update || 0).toBe(0);

    // # Close modal and wait for it to disappear
    await teamSettings.close();
    await expect(teamSettings.container).not.toBeVisible();

    // # Reopen Team Settings Modal to confirm removal persisted
    teamSettings = await channelsPage.openTeamSettings();

    // * Verify icon was removed - initial is shown, image is not
    await expect(infoSettings.teamIconInitial).toBeVisible();
    await expect(infoSettings.teamIconImage).not.toBeVisible();
});
