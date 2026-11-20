// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Info Tab
 * @reference MM-67920
 */

import {getAsset} from '@/asset';
import {Api, expect, Msg, openTeamSettings, settle, test} from '@mattermost/playwright-lib';

test.describe('Team Settings Modal - Info Tab', () => {
    /**
     * MM-67920 Open and close Team Settings Modal
     * @objective Verify basic modal open/close functionality
     */
    test('MM-67920 Open and close Team Settings Modal', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Settings
        const settings = await openTeamSettings(app);

        // * Verify Info tab is selected by default
        await expect(settings.tabs.tab('info')).toBeSelected();

        // # Close modal
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();

        // * Verify modal closes
        await expect(settings).not.toBeVisible();
    });

    /**
     * MM-67920 Edit team name and save changes
     * @objective Verify team name can be edited and saved
     */
    test('MM-67920 Edit team name and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Settings
        const settings = await openTeamSettings(app);

        // * Verify current team name is displayed
        await expect(settings.info.name.container).toHaveValue(team.display_name);

        // # Edit team name and save
        const newTeamName = `Updated Team ${pw.random.id()}`;
        await settings.info.name.container.fill(newTeamName);
        await settle(settings.savePanel.saveButton, {wait: Api.PatchTeam}).click();

        // * Wait for "Settings saved" message
        await expect(settings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);
        await expect(settings.savePanel.messageText).toBeVisible();

        // * Verify team name updated via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.display_name).toBe(newTeamName);

        // # Close modal
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();

        // * Verify modal closes without warning
        await expect(settings).not.toBeVisible();
    });

    /**
     * MM-67920 Edit team description and save changes
     * @objective Verify team description can be edited and saved
     */
    test('MM-67920 Edit team description and save changes', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Settings
        const settings = await openTeamSettings(app);

        // # Edit team description and save
        const newDescription = `Test description ${pw.random.id()}`;
        await settings.info.description.container.fill(newDescription);
        await settle(settings.savePanel.saveButton, {wait: Api.PatchTeam}).click();

        // * Wait for "Settings saved" message
        await expect(settings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);
        await expect(settings.savePanel.messageText).toBeVisible();

        // * Verify description updated via API
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.description).toBe(newDescription);

        // # Close modal
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();

        // * Verify modal closes
        await expect(settings).not.toBeVisible();
    });

    /**
     * MM-67920 Upload and Remove team icon
     * @see MM-T391 (legacy Zephyr ID)
     * @objective Verify team icon can be uploaded and removed
     */
    test('MM-67920 Upload and Remove team icon', async ({pw}) => {
        // # Set up admin user and login
        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Settings
        const settings = await openTeamSettings(app);
        const {picture} = settings.info;

        // * Verify the team shows its initials and no Remove button before an upload
        await expect(picture.initials).toBeVisible();
        await expect(picture.removeButton).toHaveCount(0);

        // # Upload team icon using asset file
        // The native file input owns the upload action.
        await picture.upload.chooseFiles(getAsset('mattermost-icon_128x128.png'));

        // * Verify the upload preview replaces the initials and the Remove button appears
        await expect(picture.preview).toBeVisible();
        await expect(picture.initials).toHaveCount(0);
        await expect(picture.removeButton).toBeVisible();

        // # Save changes
        await settle(settings.savePanel.saveButton, {wait: Api.SetTeamIcon}).click();
        await expect(settings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);
        await expect(settings.savePanel.messageText).toBeVisible();

        // * Get team data after upload to verify icon exists via API
        const teamWithIcon = await adminClient.getTeam(team.id);
        expect(teamWithIcon.last_team_icon_update).toBeGreaterThan(0);

        // # Close and reopen modal to verify persistence
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();
        await expect(settings).not.toBeVisible();
        const reopened = await openTeamSettings(app);
        const reopenedPicture = reopened.info.picture;

        // * Verify uploaded icon persists after reopening modal
        await expect(reopenedPicture.imageImg).toBeVisible();
        await expect(reopenedPicture.removeButton).toBeVisible();
        await expect(reopenedPicture.initials).toHaveCount(0);

        // # Remove the icon
        await settle(reopenedPicture.removeButton, {wait: Api.RemoveTeamIcon}).click();

        // * Verify icon was removed - the initials show again in the modal
        await expect(reopenedPicture.initials).toBeVisible();

        // * Verify icon was removed via API
        await expect.poll(async () => (await adminClient.getTeam(team.id)).last_team_icon_update || 0).toBe(0);

        // # Close modal
        await reopened.closeButton.click();
        await expect(reopened).not.toBeVisible();
    });
});
