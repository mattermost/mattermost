// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

async function skipIfNoEnterpriseLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.IsLicensed !== 'true', 'Skipping test - server does not have an enterprise license');
}

async function enableManagedCategories(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableManagedChannelCategories: true,
        },
    });
}

async function disableManagedCategories(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableManagedChannelCategories: false,
        },
    });
}

async function createChannelWithManagedCategory(
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

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that a Channel Admin can assign a managed category to a channel via the channel settings modal,
     * and the category appears in the sidebar with the channel under it.
     */
    test(
        'Channel Admin can assign a managed category via channel settings',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup with admin user and enterprise license
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and navigate to town-square
            const {page, channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Create a new channel
            const channelName = `managed-assign-${Date.now()}`;
            await channelsPage.newChannel(channelName, 'O');
            await channelsPage.toBeVisible();

            // # Open channel settings and navigate to info tab
            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            // * Verify managed category selector is visible
            const managedSelector = channelSettingsModal.container.locator('.ManagedCategory__control');
            await expect(managedSelector).toBeVisible();

            // # Click the selector, type a new category name, and select "Create new category"
            await managedSelector.click();
            const input = channelSettingsModal.container.getByRole('combobox');
            await input.fill('Operations');

            const createOption = page.getByRole('option', {name: 'Create new category: Operations'});
            await expect(createOption).toBeVisible();
            await createOption.click();

            // # Save and close
            await channelSettingsModal.save();
            await pw.wait(pw.duration.two_sec);
            await channelSettingsModal.close();

            // * Verify the managed category appears in the sidebar with the channel under it
            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Operations')).toBeVisible();

            const operationsSection = sidebar.locator('.SidebarChannelGroup').filter({hasText: 'Operations'});
            await expect(operationsSection.locator(`#sidebarItem_${channelName}`)).toBeVisible();
        },
    );

    /**
     * @objective Verify that a Channel Admin can remove a managed category from a channel via the channel settings modal,
     * and the channel returns to the default CHANNELS section.
     */
    test(
        'Channel Admin can remove a managed category via channel settings',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Removable', 'remove');
            await adminClient.addToChannel(adminUser.id, channel.id);

            // # Log in and navigate to the channel
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Verify the managed category is visible in the sidebar
            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Removable')).toBeVisible();

            // # Open channel settings and click the clear button to remove the category
            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            const clearButton = channelSettingsModal.container.locator('.ManagedCategory__clear-indicator');
            await expect(clearButton).toBeVisible();
            await clearButton.click();
            await pw.wait(pw.duration.half_sec);

            // * Verify the clear button is gone
            await expect(clearButton).not.toBeVisible();

            // # Save and close
            await channelSettingsModal.save();
            await pw.wait(pw.duration.two_sec);
            await channelSettingsModal.close();

            // * Verify the managed category is removed and the channel is back under CHANNELS
            await expect(sidebar.getByText('Removable')).not.toBeVisible();

            const channelsSection = sidebar.locator('.SidebarChannelGroup').filter({hasText: 'CHANNELS'});
            await expect(channelsSection.locator(`#sidebarItem_${channel.name}`)).toBeVisible();
        },
    );

    /**
     * @objective Verify that the managed category selector is not visible in channel settings when the feature is disabled.
     */
    test(
        'managed category selector is not visible when feature is disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and disable managed categories
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
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

    /**
     * @objective Verify that a managed category can be assigned to a channel during creation via the new channel modal.
     */
    test('managed category can be assigned when creating a new channel', {tag: '@managed_categories'}, async ({pw}) => {
        // # Initialize setup and enable managed categories
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        // # Log in and open the new channel modal
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        const displayName = `New Managed ${Date.now()}`;
        await newChannelModal.fillDisplayName(displayName);

        // * Verify managed category selector is visible
        const managedSelector = newChannelModal.container.locator('.ManagedCategory__control');
        await expect(managedSelector).toBeVisible();

        // # Select a new managed category and create the channel
        await managedSelector.click();
        const input = newChannelModal.container.getByRole('combobox');
        await input.fill('Flight Ops');

        const createOption = page.getByRole('option', {name: 'Create new category: Flight Ops'});
        await expect(createOption).toBeVisible();
        await createOption.click();

        await newChannelModal.create();
        await channelsPage.toBeVisible();
        await pw.wait(pw.duration.two_sec);

        // * Verify the managed category appears in the sidebar
        const sidebar = channelsPage.sidebarLeft.container;
        await expect(sidebar.getByText('Flight Ops')).toBeVisible();
    });

    /**
     * @objective Verify that managed categories appear at the top of the sidebar above personal categories like CHANNELS.
     */
    test(
        'managed categories appear at the top of the sidebar above personal categories',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Alpha Priority', 'alpha');
            await adminClient.addToChannel(user.id, channel.id);

            // # Log in as regular user
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // * Verify the managed category is visible and positioned above CHANNELS
            const sidebar = channelsPage.sidebarLeft.container;
            const managedCategory = sidebar.getByText('Alpha Priority');
            await expect(managedCategory).toBeVisible();

            const channelsHeader = sidebar.getByText('CHANNELS', {exact: true});
            await expect(channelsHeader).toBeVisible();
            const managedBox = await managedCategory.boundingBox();
            const channelsBox = await channelsHeader.boundingBox();

            expect(managedBox).toBeTruthy();
            expect(channelsBox).toBeTruthy();
            expect(managedBox!.y).toBeLessThan(channelsBox!.y);
        },
    );

    /**
     * @objective Verify that a managed category is only visible to users who are members of at least one channel in it.
     */
    test(
        'managed category is only visible when user is a member of a channel in it',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel with a managed category (without adding the user)
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            await createChannelWithManagedCategory(adminClient, team.id, 'Secret Ops', 'secret');

            // # Log in as regular user who is not a member of the channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // * Verify the managed category is not visible
            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Secret Ops')).not.toBeVisible();
        },
    );

    /**
     * @objective Verify that channels within a managed category are sorted alphabetically by display name.
     */
    test('managed categories sort channels alphabetically', {tag: '@managed_categories'}, async ({pw}) => {
        // # Initialize setup and create two channels with the same managed category
        const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const suffix = Date.now();
        const channelB = await adminClient.createChannel({
            team_id: team.id,
            name: `bravo-${suffix}`,
            display_name: `Bravo Channel`,
            type: 'O',
        });
        const channelA = await adminClient.createChannel({
            team_id: team.id,
            name: `alpha-${suffix}`,
            display_name: `Alpha Channel`,
            type: 'O',
        });

        // # Assign both to the same managed category and add user
        await adminClient.patchChannel(channelB.id, {managed_category_name: 'Sorted Category'});
        await adminClient.patchChannel(channelA.id, {managed_category_name: 'Sorted Category'});

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

    /**
     * @objective Verify that the Move To menu item is disabled for non-admin users on channels in managed categories.
     */
    test(
        'Move To is disabled for non-admin users on channels in managed categories',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
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

            await channelItem.hover();
            const menuButton = channelItem.getByRole('button', {name: /Channel options/});
            await menuButton.click();

            // * Verify the Move To menu item is visible but disabled
            const moveToMenuItem = channelsPage.page.getByRole('menuitem', {name: /Move to/i});
            await expect(moveToMenuItem).toBeVisible();

            const isDisabled = await moveToMenuItem.evaluate((el) => {
                return el.classList.contains('Mui-disabled') || el.getAttribute('aria-disabled') === 'true';
            });
            expect(isDisabled).toBe(true);
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
            // # Initialize setup and create two channels with the same managed category
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
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

    /**
     * @objective Verify that when an admin assigns a managed category to a channel, the category appears in the
     * sidebar of other users in real-time via websocket.
     */
    test(
        'managed category appears in real-time when admin assigns a channel to it',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel without a managed category
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
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
            await adminClient.patchChannel(channel.id, {managed_category_name: 'Realtime Ops'});

            // * Verify the managed category appears in real-time
            await pw.waitUntil(
                async () => {
                    return await sidebar
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
     * @objective Verify that the Enable Managed Channel Categories setting is available in the System Console
     * under Site Configuration > Users and Teams.
     */
    test(
        'Enable Managed Channel Categories setting is available in System Console',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);

            // # Log in and navigate to the System Console
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            // # Navigate to Users and Teams
            await systemConsolePage.sidebar.siteConfiguration.usersAndTeams.click();
            await systemConsolePage.usersAndTeams.toBeVisible();

            // * Verify the setting is visible
            const setting = systemConsolePage.usersAndTeams.container.getByTestId(
                'TeamSettings.EnableManagedChannelCategoriestrue',
            );
            await expect(setting).toBeVisible();
        },
    );

    /**
     * @objective Verify that a non-channel-admin user sees the managed category selector as disabled in channel settings.
     */
    test(
        'non-channel-admin sees the managed category selector as disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
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
            const disabledControl = channelSettingsModal.container.locator('.ManagedCategory__control--is-disabled');
            await expect(disabledControl).toBeVisible();

            await channelSettingsModal.close();
        },
    );
});
