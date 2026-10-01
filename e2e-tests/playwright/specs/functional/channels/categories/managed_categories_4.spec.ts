// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createChannelWithManagedCategory,
    enableManagedCategories,
    setupManagedCategoriesTest,
    skipIfNoEnterpriseLicense,
} from './managed_categories_helpers';

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that the Favorite menu item is disabled in the channel options menu for channels in managed categories.
     */
    test(
        'channel context menu shows favorite as disabled in managed category',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Context Menu', 'ctx');
            await adminClient.addToChannel(user.id, channel.id);

            // # Log in as regular user
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Open the channel options menu via the three-dot button
            const sidebar = channelsPage.sidebarLeft.container;
            const channelItem = sidebar.locator(`#sidebarItem_${channel.name}`);
            await expect(channelItem).toBeVisible();

            // Wait for managed-category data to load before opening the menu so
            // that isInManagedCategory is already true when the menu renders.
            await pw.waitUntil(
                async () =>
                    sidebar
                        .getByText('Context Menu')
                        .isVisible()
                        .catch(() => false),
                {timeout: 15000},
            );

            await channelItem.hover();
            const menuButton = channelItem.getByRole('button', {name: /Channel options/});
            await menuButton.click();

            // * Verify the Favorite menu item is visible but disabled
            const favoriteMenuItem = channelsPage.page.getByRole('menuitem', {name: /Favorite/i});
            await expect(favoriteMenuItem).toBeVisible();
            await expect(favoriteMenuItem).toHaveAttribute('aria-disabled', 'true');
        },
    );

    /**
     * @objective Verify that the Move To menu item is disabled for non-admin users on channels in managed categories.
     */
    test(
        'Move To is disabled for non-admin users on channels in managed categories',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Move', 'nomove');
            await adminClient.addToChannel(user.id, channel.id);

            // # Log in as regular user
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Open the channel options menu via the three-dot button
            const sidebar = channelsPage.sidebarLeft.container;
            const channelItem = sidebar.locator(`#sidebarItem_${channel.name}`);
            await expect(channelItem).toBeVisible();

            await pw.waitUntil(
                async () =>
                    sidebar
                        .getByText('No Move')
                        .isVisible()
                        .catch(() => false),
                {timeout: 15000},
            );

            await channelItem.hover();
            const menuButton = channelItem.getByRole('button', {name: /Channel options/});
            await menuButton.click();

            // * Verify the Move To menu item is visible but disabled
            const moveToMenuItem = channelsPage.page.getByRole('menuitem', {name: /Move to/i});
            await expect(moveToMenuItem).toBeVisible();
            await expect(moveToMenuItem).toHaveAttribute('aria-disabled', 'true');
        },
    );

    /**
     * @objective Verify that assigning the same managed category name to multiple channels groups them under a single
     * category header in the sidebar.
     */
    test(
        'assigning the same category name to multiple channels groups them together',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create two channels with the same managed category
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const suffix = Date.now();
            const channel1 = await createChannelWithManagedCategory(
                adminClient,
                team.id,
                'Shared Category',
                `shared1-${suffix}`,
            );
            const channel2 = await createChannelWithManagedCategory(
                adminClient,
                team.id,
                'Shared Category',
                `shared2-${suffix}`,
            );

            // # Add the user to both channels
            await adminClient.addToChannel(user.id, channel1.id);
            await adminClient.addToChannel(user.id, channel2.id);

            // # Log in as regular user
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // * Verify only one category header exists and both channels are under it
            const sidebar = channelsPage.sidebarLeft.container;
            const categories = sidebar.getByText('Shared Category');
            await expect(categories).toHaveCount(1);

            await expect(sidebar.locator(`#sidebarItem_${channel1.name}`)).toBeVisible();
            await expect(sidebar.locator(`#sidebarItem_${channel2.name}`)).toBeVisible();
        },
    );
});
