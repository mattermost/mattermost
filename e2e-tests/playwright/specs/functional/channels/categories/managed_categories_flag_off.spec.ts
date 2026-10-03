// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Split out of managed_categories.spec.ts: this is the only test in that suite needing
 * the ManagedChannelCategories feature flag off, the opposite of every other test there,
 * so it belongs in its own file under the one-ensureFeatureFlag-call-per-file convention.
 */

import {ensureFeatureFlag, expect, getRandomId, test} from '@mattermost/playwright-lib';

async function skipIfNoEnterpriseLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    const enterpriseSkus = ['enterprise', 'advanced', 'entry'];
    test.skip(
        license.IsLicensed !== 'true' || !enterpriseSkus.includes(license.SkuShortName),
        'Skipping test - server does not have an enterprise license',
    );
}

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
    test.beforeAll(async () => {
        await ensureFeatureFlag('ManagedChannelCategories', false);
    });

    /**
     * @objective Verify that the managed category selector is not visible in channel settings when the feature is disabled.
     */
    test(
        'managed category selector is not visible when feature is disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and disable managed categories
            const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
            await skipIfNoEnterpriseLicense(adminClient);
            await disableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open channel settings
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            // * Verify managed category selector is not visible
            const managedSelector = channelSettingsModal.container.locator('.ManagedCategory__control');
            await expect(managedSelector).not.toBeVisible();

            await channelSettingsModal.close();
        },
    );
});
