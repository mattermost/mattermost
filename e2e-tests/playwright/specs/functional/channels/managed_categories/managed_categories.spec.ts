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
    // ────────────────────────────────────────────────────────────────
    // Section 2.2 — Channel Settings Modal: assigning a managed category
    // ────────────────────────────────────────────────────────────────

    test(
        'Channel Admin can assign a managed category via channel settings',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const {page, channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const channelName = `managed-assign-${Date.now()}`;
            await channelsPage.newChannel(channelName, 'O');
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            const managedSelector = channelSettingsModal.container.locator('.ManagedCategory__control');
            await expect(managedSelector).toBeVisible();

            await managedSelector.click();
            const input = channelSettingsModal.container.getByRole('combobox');
            await input.fill('Operations');

            const createOption = page.getByRole('option', {name: 'Create new category: Operations'});
            await expect(createOption).toBeVisible();
            await createOption.click();

            await channelSettingsModal.save();
            await pw.wait(pw.duration.two_sec);
            await channelSettingsModal.close();

            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Operations')).toBeVisible();

            const operationsSection = sidebar.locator('.SidebarChannelGroup').filter({hasText: 'Operations'});
            await expect(operationsSection.locator(`#sidebarItem_${channelName}`)).toBeVisible();
        },
    );

    test(
        'Channel Admin can remove a managed category via channel settings',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Removable', 'remove');
            await adminClient.addToChannel(adminUser.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Removable')).toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            const clearButton = channelSettingsModal.container.locator('.ManagedCategory__clear-indicator');
            await expect(clearButton).toBeVisible();
            await clearButton.click();
            await pw.wait(pw.duration.half_sec);

            await expect(clearButton).not.toBeVisible();

            await channelSettingsModal.save();
            await pw.wait(pw.duration.two_sec);
            await channelSettingsModal.close();

            await expect(sidebar.getByText('Removable')).not.toBeVisible();

            const channelsSection = sidebar.locator('.SidebarChannelGroup').filter({hasText: 'CHANNELS'});
            await expect(channelsSection.locator(`#sidebarItem_${channel.name}`)).toBeVisible();
        },
    );

    test(
        'managed category selector is not visible when feature is disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await disableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            const managedSelector = channelSettingsModal.container.locator('.ManagedCategory__control');
            await expect(managedSelector).not.toBeVisible();

            await channelSettingsModal.close();
        },
    );

    // ────────────────────────────────────────────────────────────────
    // Section 2.4 — New Channel Modal: assigning at creation
    // ────────────────────────────────────────────────────────────────

    test('managed category can be assigned when creating a new channel', {tag: '@managed_categories'}, async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const {page, channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        const displayName = `New Managed ${Date.now()}`;
        await newChannelModal.fillDisplayName(displayName);

        const managedSelector = newChannelModal.container.locator('.ManagedCategory__control');
        await expect(managedSelector).toBeVisible();

        await managedSelector.click();
        const input = newChannelModal.container.getByRole('combobox');
        await input.fill('Flight Ops');

        const createOption = page.getByRole('option', {name: 'Create new category: Flight Ops'});
        await expect(createOption).toBeVisible();
        await createOption.click();

        await newChannelModal.create();
        await channelsPage.toBeVisible();
        await pw.wait(pw.duration.two_sec);

        const sidebar = channelsPage.sidebarLeft.container;
        await expect(sidebar.getByText('Flight Ops')).toBeVisible();
    });

    // ────────────────────────────────────────────────────────────────
    // Section 3.1 — Sidebar: managed categories display and position
    // ────────────────────────────────────────────────────────────────

    test(
        'managed categories appear at the top of the sidebar above personal categories',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Alpha Priority', 'alpha');
            await adminClient.addToChannel(user.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

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

    test(
        'managed category is only visible when user is a member of a channel in it',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            await createChannelWithManagedCategory(adminClient, team.id, 'Secret Ops', 'secret');

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Secret Ops')).not.toBeVisible();
        },
    );

    test('managed categories sort channels alphabetically', {tag: '@managed_categories'}, async ({pw}) => {
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

        await adminClient.patchChannel(channelB.id, {managed_category_name: 'Sorted Category'});
        await adminClient.patchChannel(channelA.id, {managed_category_name: 'Sorted Category'});

        await adminClient.addToChannel(user.id, channelA.id);
        await adminClient.addToChannel(user.id, channelB.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

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

    // ────────────────────────────────────────────────────────────────
    // Section 3.3 — Favoriting is blocked
    // ────────────────────────────────────────────────────────────────

    test('channels in managed categories cannot be favorited', {tag: '@managed_categories'}, async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Favorites', 'nofav');
        await adminClient.addToChannel(adminUser.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const favoriteButton = channelsPage.page.locator('#toggleFavorite');
        await expect(favoriteButton).toBeVisible();
        await expect(favoriteButton).toBeDisabled();
    });

    // ────────────────────────────────────────────────────────────────
    // Section 3.5 — No context menu on managed categories
    // ────────────────────────────────────────────────────────────────

    test('managed categories do not show a context menu', {tag: '@managed_categories'}, async ({pw}) => {
        const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Menu', 'nomenu');
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const sidebar = channelsPage.sidebarLeft.container;
        const categoryHeader = sidebar.getByText('No Menu');
        await expect(categoryHeader).toBeVisible();

        await categoryHeader.click({button: 'right'});
        await pw.wait(pw.duration.one_sec);

        const categoryMenu = channelsPage.page.locator('.SidebarCategoryMenu');
        await expect(categoryMenu).not.toBeVisible();
    });

    // ────────────────────────────────────────────────────────────────
    // Section 3.6 — Channel context menu: favorite disabled, Move To for non-admin
    // ────────────────────────────────────────────────────────────────

    test(
        'channel context menu shows favorite as disabled in managed category',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Context Menu', 'ctx');
            await adminClient.addToChannel(user.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft.container;
            const channelItem = sidebar.locator(`#sidebarItem_${channel.name}`);
            await expect(channelItem).toBeVisible();

            await channelItem.hover();
            const menuButton = sidebar.getByRole('button', {name: `Channel options for ${channel.name}`});
            await menuButton.click();

            const favoriteMenuItem = channelsPage.page.getByRole('menuitem', {name: /Favorite/i});
            await expect(favoriteMenuItem).toBeVisible();

            const isDisabled = await favoriteMenuItem.evaluate((el) => {
                return el.classList.contains('Mui-disabled') || el.getAttribute('aria-disabled') === 'true';
            });
            expect(isDisabled).toBe(true);
        },
    );

    test(
        'Move To is disabled for non-admin users on channels in managed categories',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'No Move', 'nomove');
            await adminClient.addToChannel(user.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft.container;
            const channelItem = sidebar.locator(`#sidebarItem_${channel.name}`);
            await expect(channelItem).toBeVisible();

            await channelItem.hover();
            const menuButton = sidebar.getByRole('button', {name: `Channel options for ${channel.name}`});
            await menuButton.click();

            const moveToMenuItem = channelsPage.page.getByRole('menuitem', {name: /Move to/i});
            await expect(moveToMenuItem).toBeVisible();

            const isDisabled = await moveToMenuItem.evaluate((el) => {
                return el.classList.contains('Mui-disabled') || el.getAttribute('aria-disabled') === 'true';
            });
            expect(isDisabled).toBe(true);
        },
    );

    // ────────────────────────────────────────────────────────────────
    // Section 3.7 — Categories are strings, no ownership
    // ────────────────────────────────────────────────────────────────

    test(
        'assigning the same category name to multiple channels groups them together',
        {tag: '@managed_categories'},
        async ({pw}) => {
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

            await adminClient.addToChannel(user.id, channel1.id);
            await adminClient.addToChannel(user.id, channel2.id);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft.container;
            const categories = sidebar.getByText('Shared Category');
            await expect(categories).toHaveCount(1);

            await expect(sidebar.locator(`#sidebarItem_${channel1.name}`)).toBeVisible();
            await expect(sidebar.locator(`#sidebarItem_${channel2.name}`)).toBeVisible();
        },
    );

    // ────────────────────────────────────────────────────────────────
    // WebSocket / real-time: category appears when mapping is added
    // ────────────────────────────────────────────────────────────────

    test(
        'managed category appears in real-time when admin assigns a channel to it',
        {tag: '@managed_categories'},
        async ({pw}) => {
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Realtime Ops')).not.toBeVisible();

            await adminClient.patchChannel(channel.id, {managed_category_name: 'Realtime Ops'});

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

    // ────────────────────────────────────────────────────────────────
    // Configuration: System Console toggle
    // ────────────────────────────────────────────────────────────────

    test(
        'Enable Managed Channel Categories setting is available in System Console',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await systemConsolePage.sidebar.siteConfiguration.usersAndTeams.click();
            await systemConsolePage.usersAndTeams.toBeVisible();

            const setting = systemConsolePage.usersAndTeams.container.getByTestId(
                'TeamSettings.EnableManagedChannelCategoriestrue',
            );
            await expect(setting).toBeVisible();
        },
    );

    // ────────────────────────────────────────────────────────────────
    // Permissions: non-admin cannot modify managed category
    // ────────────────────────────────────────────────────────────────

    test(
        'non-channel-admin sees the managed category selector as disabled',
        {tag: '@managed_categories'},
        async ({pw}) => {
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Locked', 'locked');
            await adminClient.addToChannel(user.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            const disabledControl = channelSettingsModal.container.locator('.ManagedCategory__control--is-disabled');
            await expect(disabledControl).toBeVisible();

            await channelSettingsModal.close();
        },
    );
});
