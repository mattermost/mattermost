// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createChannelWithManagedCategory,
    enableManagedCategories,
    managedCategorySelectorWrapper,
    setupManagedCategoriesTest,
} from './managed_categories_helpers';

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that when an admin assigns a managed category to a channel, the category appears in the
     * sidebar of other users in real-time via websocket.
     */
    test(
        'managed category appears in real-time when admin assigns a channel to it',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel without a managed category
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await pw.skipIfNoLicense();
            await enableManagedCategories();
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `realtime-${Date.now()}`,
                display_name: `Realtime Channel ${Date.now()}`,
                type: 'O',
            });
            await adminClient.addToChannel(user.id, channel.id);

            // # Log in as regular user
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // * Verify the managed category does not exist yet
            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Realtime Ops')).not.toBeVisible();

            // # Admin assigns a managed category to the channel via API
            await adminClient.patchChannel(channel.id, {managed_category_name: 'Realtime Ops'} as any);

            // * Verify the managed category appears in real-time
            await pw.waitUntil(
                async () => {
                    return sidebar
                        .getByText('Realtime Ops')
                        .isVisible()
                        .catch(() => false);
                },
                {timeout: 10000},
            );

            await expect(sidebar.getByText('Realtime Ops')).toBeVisible();
            await expect(sidebar.locator(`#sidebarItem_${channel.name}`)).toBeVisible();
        },
    );

    /**
     * @objective Verify that a non-channel-admin user sees the managed category selector as disabled in channel settings.
     */
    test(
        'non-channel-admin sees the managed category selector as disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await pw.skipIfNoLicense();
            await enableManagedCategories();
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Locked', 'locked');
            await adminClient.addToChannel(user.id, channel.id);

            // # Log in as regular user and open channel settings
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            // * Verify the managed category selector is disabled
            const disabledControl = managedCategorySelectorWrapper(channelSettingsModal.container).locator(
                '.CategorySelector__control--is-disabled',
            );
            await expect(disabledControl).toBeVisible();

            await channelSettingsModal.close();
        },
    );
});
