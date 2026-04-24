// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createChannelWithManagedCategory, enableManagedCategories, skipIfNoEnterpriseLicense} from './support';

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that the favorite button is disabled for channels in managed categories.
     */
    test('channels in managed categories cannot be favorited', {tag: '@managed_categories'}, async ({pw}) => {
        // # Initialize setup and create a channel with a managed category
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Favorites', 'nofav');
        await adminClient.addToChannel(adminUser.id, channel.id);

        // # Log in and navigate to the managed channel
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the favorite button is visible but disabled
        const favoriteButton = channelsPage.page.locator('#toggleFavorite');
        await expect(favoriteButton).toBeVisible();
        await expect(favoriteButton).toBeDisabled();
    });

    /**
     * @objective Verify that managed category headers do not show a context menu on right-click.
     */
    test('managed categories do not show a context menu', {tag: '@managed_categories'}, async ({pw}) => {
        // # Initialize setup and create a channel with a managed category
        const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
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
        await expect(categoryHeader).toBeVisible();

        await categoryHeader.click({button: 'right'});
        await pw.wait(pw.duration.one_sec);

        // * Verify no context menu appears
        const categoryMenu = channelsPage.page.locator('.SidebarCategoryMenu');
        await expect(categoryMenu).not.toBeVisible();
    });

    /**
     * @objective Verify that the Favorite menu item is disabled in the channel options menu for channels in managed categories.
     */
    test(
        'channel context menu shows favorite as disabled in managed category',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
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

            await channelItem.hover();
            const menuButton = channelItem.getByRole('button', {name: /Channel options/});
            await menuButton.click();

            // * Verify the Favorite menu item is visible but disabled
            const favoriteMenuItem = channelsPage.page.getByRole('menuitem', {name: /Favorite/i});
            await expect(favoriteMenuItem).toBeVisible();

            const isDisabled = await favoriteMenuItem.evaluate((el) => {
                return el.classList.contains('Mui-disabled') || el.getAttribute('aria-disabled') === 'true';
            });
            expect(isDisabled).toBe(true);
        },
    );
});
