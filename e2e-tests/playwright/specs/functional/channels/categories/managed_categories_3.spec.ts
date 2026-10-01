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
     * @objective Verify that channels within a managed category are sorted alphabetically by display name.
     */
    test('managed categories sort channels alphabetically', {tag: '@managed_categories'}, async ({pw}) => {
        await pw.ensureFeatureFlag('ManagedChannelCategories', true);

        // # Initialize setup and create two channels with the same managed category
        const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories();
        await adminClient.addToTeam(team.id, adminUser.id);

        const suffix = Date.now();
        const channelB = await adminClient.createChannel({
            team_id: team.id,
            name: `bravo-${suffix}`,
            display_name: 'Bravo Channel',
            type: 'O',
        });
        const channelA = await adminClient.createChannel({
            team_id: team.id,
            name: `alpha-${suffix}`,
            display_name: 'Alpha Channel',
            type: 'O',
        });

        // # Assign both to the same managed category and add user
        await adminClient.patchChannel(channelB.id, {managed_category_name: 'Sorted Category'} as any);
        await adminClient.patchChannel(channelA.id, {managed_category_name: 'Sorted Category'} as any);

        await adminClient.addToChannel(user.id, channelA.id);
        await adminClient.addToChannel(user.id, channelB.id);

        // # Log in as regular user
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // * Verify both channels are visible and Alpha appears before Bravo
        const sidebar = channelsPage.sidebarLeft.container;
        await expect(sidebar.getByText('Sorted Category')).toBeVisible();

        const alphaItem = sidebar.locator(`#sidebarItem_${channelA.name}`);
        const bravoItem = sidebar.locator(`#sidebarItem_${channelB.name}`);

        await expect(alphaItem).toBeVisible();
        await expect(bravoItem).toBeVisible();

        const alphaBox = await alphaItem.boundingBox();
        const bravoBox = await bravoItem.boundingBox();

        expect(alphaBox).toBeTruthy();
        expect(bravoBox).toBeTruthy();
        expect(alphaBox!.y).toBeLessThan(bravoBox!.y);
    });

    /**
     * @objective Verify that the favorite button is disabled for channels in managed categories.
     */
    test('channels in managed categories cannot be favorited', {tag: '@managed_categories'}, async ({pw}) => {
        await pw.ensureFeatureFlag('ManagedChannelCategories', true);

        // # Initialize setup and create a channel with a managed category
        const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories();
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Favorites', 'nofav');
        await adminClient.addToChannel(adminUser.id, channel.id);

        // # Log in and navigate to the managed channel
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const sidebar = channelsPage.sidebarLeft.container;
        await pw.waitUntil(
            async () =>
                sidebar
                    .getByText('No Favorites')
                    .isVisible()
                    .catch(() => false),
            {timeout: 15000},
        );

        // * Verify the favorite button is visible but disabled
        const favoriteButton = channelsPage.page.locator('#toggleFavorite');
        await expect(favoriteButton).toBeVisible();
        await expect(favoriteButton).toBeDisabled();
    });

    /**
     * @objective Verify that managed category headers do not show a context menu on right-click.
     */
    test('managed categories do not show a context menu', {tag: '@managed_categories'}, async ({pw}) => {
        await pw.ensureFeatureFlag('ManagedChannelCategories', true);

        // # Initialize setup and create a channel with a managed category
        const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories();
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Menu', 'nomenu');
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in as regular user
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Right-click on the managed category header
        const sidebar = channelsPage.sidebarLeft.container;
        const categoryHeader = sidebar.getByText('No Menu');
        await pw.waitUntil(async () => categoryHeader.isVisible().catch(() => false), {timeout: 15000});
        await expect(categoryHeader).toBeVisible();

        await categoryHeader.click({button: 'right'});
        await pw.wait(pw.duration.one_sec);

        // * Verify no context menu appears
        const categoryMenu = channelsPage.page.locator('.SidebarCategoryMenu');
        await expect(categoryMenu).not.toBeVisible();
    });
});
