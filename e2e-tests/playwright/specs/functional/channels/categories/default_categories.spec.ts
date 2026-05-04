// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

async function skipIfNoEnterpriseLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.IsLicensed !== 'true', 'Skipping test - server does not have an enterprise license');
}

async function enableChannelCategorySorting(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableChannelCategorySorting: true,
        },
    });
}

async function disableChannelCategorySorting(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableChannelCategorySorting: false,
        },
    });
}

test.describe('Channel Category Sorting', () => {
    /**
     * @objective Verify that the default category selector is not visible in channel settings when channel category sorting is disabled.
     */
    test(
        'default category selector is not visible when channel category sorting is disabled',
        {tag: '@channel_category_sorting'},
        async ({pw}) => {
            // # Initialize setup and disable channel category sorting
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await disableChannelCategorySorting(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open channel settings
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            // * Verify the default category selector is not rendered
            const defaultCategorySelector = channelSettingsModal.container
                .locator('.CategorySelector')
                .filter({hasText: 'Choose a default category (optional)'});
            await expect(defaultCategorySelector).toHaveCount(0);

            await channelSettingsModal.close();
        },
    );

    /**
     * @objective Verify that a default category can be assigned when creating a new channel via the new channel modal.
     */
    test(
        'default category can be assigned when creating a new channel',
        {tag: '@channel_category_sorting'},
        async ({pw}) => {
            // # Initialize setup and enable channel category sorting
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoEnterpriseLicense(adminClient);
            await enableChannelCategorySorting(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open the new channel modal
            const {page, channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const newChannelModal = await channelsPage.openNewChannelModal();
            const displayName = `New Default Cat ${Date.now()}`;
            await newChannelModal.fillDisplayName(displayName);

            // # Locate the default category selector and select a new category
            const defaultCategorySection = newChannelModal.container.locator('.CategorySelector').first();
            await expect(defaultCategorySection).toContainText('Choose a default category (optional)');

            const defaultCategoryControl = defaultCategorySection.locator('.CategorySelector__control');
            await defaultCategoryControl.click();

            const input = defaultCategorySection.getByRole('combobox');
            await input.fill('Flight Ops');

            const createOption = page.getByRole('option', {name: 'Create new category: Flight Ops'});
            await expect(createOption).toBeVisible();
            await createOption.click();

            await newChannelModal.create();
            await channelsPage.toBeVisible();
            await pw.wait(pw.duration.two_sec);

            // * Verify the new category appears in the sidebar
            const sidebar = channelsPage.sidebarLeft.container;
            await expect(sidebar.getByText('Flight Ops')).toBeVisible();
        },
    );

    /**
     * @objective Verify that a Channel Admin can assign a default category to an existing channel via the channel
     * settings modal, and the category appears in the sidebar with the channel under it for the patching user.
     */
    test('default category can be assigned via channel settings', {tag: '@channel_category_sorting'}, async ({pw}) => {
        // # Initialize setup with admin user and enterprise license
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableChannelCategorySorting(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        // # Log in and navigate to town-square
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a new channel
        const channelName = `default-assign-${Date.now()}`;
        await channelsPage.newChannel(channelName, 'O');
        await channelsPage.toBeVisible();

        // # Open channel settings and navigate to info tab
        const channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openInfoTab();

        // * Verify the default category selector is visible
        const defaultCategorySection = channelSettingsModal.container.locator('.CategorySelector').first();
        await expect(defaultCategorySection).toContainText('Choose a default category (optional)');

        // # Click the selector, type a new category name, and select "Create new category"
        const defaultCategoryControl = defaultCategorySection.locator('.CategorySelector__control');
        await defaultCategoryControl.click();

        const input = defaultCategorySection.getByRole('combobox');
        await input.fill('Operations');

        const createOption = page.getByRole('option', {name: 'Create new category: Operations'});
        await expect(createOption).toBeVisible();
        await createOption.click();

        // # Save and close
        await channelSettingsModal.save();
        await pw.wait(pw.duration.two_sec);
        await channelSettingsModal.close();

        // * Verify the default category appears in the sidebar with the channel under it
        const sidebar = channelsPage.sidebarLeft.container;
        await expect(sidebar.getByText('Operations')).toBeVisible();

        const operationsSection = sidebar.locator('.SidebarChannelGroup').filter({hasText: 'Operations'});
        await expect(operationsSection.locator(`#sidebarItem_${channelName}`)).toBeVisible();
    });

    /**
     * @objective Verify that a Channel Admin can remove a default category from a channel via the channel settings
     * modal, and reopening the modal shows the field cleared.
     */
    test('default category can be removed via channel settings', {tag: '@channel_category_sorting'}, async ({pw}) => {
        // # Initialize setup and create a channel with a default category set
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoEnterpriseLicense(adminClient);
        await enableChannelCategorySorting(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `default-cat-remove-${Date.now()}`,
            display_name: `Default remove ${Date.now()}`,
            type: 'O',
        });
        await adminClient.patchChannel(channel.id, {default_category_name: 'Removable'});
        await adminClient.addToChannel(adminUser.id, channel.id);

        // # Log in and navigate to the channel
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the default category is visible in the sidebar (admin was added after the patch set it)
        const sidebar = channelsPage.sidebarLeft.container;
        await expect(sidebar.getByText('Removable')).toBeVisible();

        // # Open channel settings and click the clear button on the default category selector
        let channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openInfoTab();

        const defaultCategorySection = channelSettingsModal.container.locator('.CategorySelector').first();
        await expect(defaultCategorySection).toContainText('Removable');

        const clearButton = defaultCategorySection.locator('.CategorySelector__clear-indicator');
        await expect(clearButton).toBeVisible();
        await clearButton.click();
        await pw.wait(pw.duration.half_sec);

        // * Verify the clear button is gone (no value selected)
        await expect(clearButton).not.toBeVisible();

        // # Save and close
        await channelSettingsModal.save();
        await pw.wait(pw.duration.two_sec);
        await channelSettingsModal.close();

        // # Reopen channel settings to verify the cleared value persisted
        channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openInfoTab();

        // * Verify the default category selector shows the placeholder (value is cleared)
        const reopenedDefaultCategorySection = channelSettingsModal.container.locator('.CategorySelector').first();
        await expect(reopenedDefaultCategorySection).toContainText('Choose a default category (optional)');

        await channelSettingsModal.close();
    });

    /**
     * @objective Verify that the Channel category sorting setting is available in the System Console
     * under Site Configuration > Users and Teams.
     */
    test(
        'Channel category sorting setting is available in System Console',
        {tag: '@channel_category_sorting'},
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
                'TeamSettings.EnableChannelCategorySortingtrue',
            );
            await expect(setting).toBeVisible();
        },
    );
});
