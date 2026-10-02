// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupManagedCategoriesTest} from './managed_categories_helpers';

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that the managed category selector is not visible in channel settings when the feature is disabled.
     */
    test(
        'managed category selector is not visible when feature is disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // Isolated in its own file: toggling this flag within a spec that also
            // sets it true would force an extra server restart between tests.
            await pw.ensureFeatureFlag('ManagedChannelCategories', false);

            // # Initialize setup
            const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
            await pw.skipIfNoLicense();
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open channel settings
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            // * Verify managed category selector is not visible. Scoped by its
            // placeholder text rather than `.last()`: with the field gone, the only
            // remaining `.CategorySelector` is the (still shown) default-category one,
            // and `.last()` would wrongly resolve to that instead of an absent element.
            const managedWrapper = channelSettingsModal.container
                .locator('.CategorySelector')
                .filter({hasText: 'managed category'});
            await expect(managedWrapper).toHaveCount(0);

            await channelSettingsModal.close();
        },
    );
});
