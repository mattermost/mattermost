// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getRandomId, test, closeChannelSettings, openChannelSettingsInfoTab} from '@mattermost/playwright-lib';

async function disableManagedCategories(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableManagedChannelCategories: false,
        },
    });
}

/**
 * Creates a uniquely-named team and user per test and adds the user to the team.
 */
async function setupManagedCategoriesTest(pw: any) {
    const {adminClient, adminUser} = await pw.getAdminClient();
    const suffix = getRandomId();

    // Guard against UseAnonymousURLs=true left by anonymous_urls tests running on the same
    // server shard. When active, newly created channels receive obfuscated slugs instead of
    // human-readable names, breaking sidebar-item selectors (e.g. #sidebarItem_managed-assign-…).
    await adminClient.patchConfig({PrivacySettings: {UseAnonymousURLs: false}});

    const team = await adminClient.createTeam({
        name: `mgd-${suffix}`,
        display_name: `Managed ${suffix}`,
        type: 'O',
    });
    const user = await pw.createNewUserProfile(adminClient, {prefix: 'mgd-user'});
    await adminClient.addToTeam(team.id, user.id);
    return {adminClient, adminUser, team, user};
}

test.describe('Managed Channel Categories (flag off)', () => {
    /**
     * @objective Verify that the managed category selector is not visible in channel settings when the feature is disabled.
     */
    test(
        'managed category selector is not visible when feature is disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', false);
            // # Initialize setup and disable managed categories
            const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
            await pw.skipIfNoLicense();
            await disableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open channel settings
            const {app} = await pw.testBrowser.login(adminUser);
            await app.channelsPage.goto({team, channel: 'town-square'});
            await expect(app.center.postCreate).toBeVisible();

            const settingsItem = await app.channelHeader.openMenuButton.clickTo(
                app.channelHeader.menu.channelSettingsMenuItem,
            );
            const channelSettingsModal = await settingsItem.clickTo(app.channelSettingsModal);
            const info = await openChannelSettingsInfoTab(channelSettingsModal);

            // * Verify managed category selector is not visible
            await expect(info.managedCategory.container).not.toBeVisible();

            await closeChannelSettings(channelSettingsModal);
        },
    );
});
