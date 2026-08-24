// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Settings > Display theme discard confirmation
 * @reference MM-70405
 */

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * Create a user and team without patching server config.
 * Cloud licenses reject PluginSettings.EnableUploads from getOnPremServerConfig().
 */
async function setupUser(pw: PlaywrightExtended) {
    const {adminClient} = await pw.getAdminClient();
    const team = await pw.createNewTeam(adminClient);
    const user = await pw.createNewUserProfile(adminClient);
    await adminClient.addToTeam(team.id, user.id);
    return {user, team};
}

test.describe('Settings Display theme discard confirmation', () => {
    /**
     * MM-70405 Same theme is not treated as an unsaved change
     * @objective Closing Settings after clicking the already saved theme does not show discard confirmation
     */
    test('MM-70405 Clicking the saved theme and closing does not show discard confirmation', async ({pw}) => {
        const {user} = await setupUser(pw);
        const {page, channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const settingsModal = await channelsPage.globalHeader.openSettings();
        const displaySettings = await settingsModal.openDisplayTab();
        await displaySettings.themeEditButton.click();
        await displaySettings.verifySectionIsExpanded('theme');

        await displaySettings.container.getByRole('button', {name: 'Denim'}).click();
        await settingsModal.closeButton.click();

        await expect(page.getByText('You have unsaved changes, are you sure you want to discard them?')).toHaveCount(0);
        await expect(settingsModal.container).not.toBeVisible();
    });

    /**
     * MM-70405 Discard confirmation stays open after an unsaved theme change
     * @objective Changing theme and closing Settings shows a usable discard confirmation
     */
    test('MM-70405 Changing theme and closing shows a discard confirmation that stays open', async ({pw}) => {
        const {user} = await setupUser(pw);
        const {page, channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const settingsModal = await channelsPage.globalHeader.openSettings();
        const displaySettings = await settingsModal.openDisplayTab();
        await displaySettings.themeEditButton.click();
        await displaySettings.verifySectionIsExpanded('theme');

        await displaySettings.container.getByRole('button', {name: 'Onyx'}).click();
        await settingsModal.closeButton.click();

        const discardMessage = page.getByText('You have unsaved changes, are you sure you want to discard them?');
        await expect(discardMessage).toBeVisible();
        await expect(settingsModal.container).toBeVisible();

        // The previous bug flashed this dialog away with the Settings modal
        await expect(discardMessage).toBeVisible({timeout: 2000});
        await expect(settingsModal.container).toBeVisible();

        await page.getByTestId('cancel-button').click();
        await expect(discardMessage).toHaveCount(0);
        await expect(settingsModal.container).toBeVisible();

        await settingsModal.closeButton.click();
        await expect(discardMessage).toBeVisible();
        await page.getByRole('button', {name: 'Yes, Discard'}).click();
        await expect(settingsModal.container).not.toBeVisible();
    });
});
