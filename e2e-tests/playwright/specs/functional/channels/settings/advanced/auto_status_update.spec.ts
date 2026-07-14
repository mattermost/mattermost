// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Helper to find the auto_status_update preference for a given user.
 */
async function getAutoStatusUpdatePreference(
    userClient: {
        getUserPreferences: (userId: string) => Promise<Array<{category: string; name: string; value: string}>>;
    },
    userId: string,
) {
    const prefs = await userClient.getUserPreferences(userId);
    return prefs.find(
        (p: {category: string; name: string}) => p.category === 'advanced_settings' && p.name === 'auto_status_update',
    );
}

test.describe('Settings > Advanced > Automatic status updates', () => {
    /**
     * @objective Verify that turning off "Automatic status updates" in the Advanced
     *            settings saves the auto_status_update preference as "false".
     */
    test('disables automatic status updates from the Advanced settings', async ({pw}) => {
        // # Initialize setup and log in
        const {team, user, userClient} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Settings and go to the Advanced tab
        const settingsModal = await channelsPage.globalHeader.openSettings();
        const advancedSettings = await settingsModal.openAdvancedTab();

        // # Turn the automatic status updates setting Off and save
        await advancedSettings.setAutoStatusUpdate(false);

        // * Verify the preference was persisted as false
        const pref = await getAutoStatusUpdatePreference(userClient, user.id);
        expect(pref).toBeDefined();
        expect(pref!.value).toBe('false');
    });

    /**
     * @objective Verify that re-enabling "Automatic status updates" saves the
     *            auto_status_update preference as "true".
     */
    test('re-enables automatic status updates after disabling via API', async ({pw}) => {
        // # Initialize setup and pre-disable the preference via API
        const {team, user, userClient} = await pw.initSetup();
        await userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'advanced_settings', name: 'auto_status_update', value: 'false'},
        ]);

        // # Log in and open Settings > Advanced
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const settingsModal = await channelsPage.globalHeader.openSettings();
        const advancedSettings = await settingsModal.openAdvancedTab();

        // # Turn the setting back On and save
        await advancedSettings.setAutoStatusUpdate(true);

        // * Verify the preference was persisted as true
        const pref = await getAutoStatusUpdatePreference(userClient, user.id);
        expect(pref).toBeDefined();
        expect(pref!.value).toBe('true');
    });
});
