// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {getRandomId, test} from '@mattermost/playwright-lib';

// The managed-category field and the default-category field both render via the
// shared CategorySelector component (classNamePrefix='CategorySelector' — there is
// no separate 'ManagedCategory' class anywhere), and both can be on screen at once
// (EnableChannelCategorySorting defaults to true). Managed is always the later of
// the two in the DOM, so `.last()` reliably picks it regardless of whether the
// default-category selector is present.
export function managedCategorySelectorWrapper(container: Locator): Locator {
    return container.locator('.CategorySelector').last();
}

export async function skipIfNoEnterpriseLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    const enterpriseSkus = ['enterprise', 'advanced', 'entry'];
    test.skip(
        license.IsLicensed !== 'true' || !enterpriseSkus.includes(license.SkuShortName),
        'Skipping test - server does not have an enterprise license',
    );
}

// Managed categories are gated solely by FeatureFlags.ManagedChannelCategories
// (MM-68496 / MM-68608). The old TeamSettings.EnableManagedChannelCategories
// config key no longer exists — these helpers remain as explicit no-ops so call
// sites stay readable next to ensureFeatureFlag('ManagedChannelCategories', …).
export async function enableManagedCategories() {}

export async function disableManagedCategories() {}

/**
 * Creates a uniquely-named team and user per test and adds the user to the team.
 */
export async function setupManagedCategoriesTest(pw: any) {
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

export async function createChannelWithManagedCategory(
    adminClient: any,
    teamId: string,
    categoryName: string,
    channelSuffix: string,
) {
    const channel = await adminClient.createChannel({
        team_id: teamId,
        name: `managed-cat-${channelSuffix}-${Date.now()}`,
        display_name: `Managed ${channelSuffix} ${Date.now()}`,
        type: 'O',
    });
    await adminClient.patchChannel(channel.id, {managed_category_name: categoryName});
    return channel;
}
