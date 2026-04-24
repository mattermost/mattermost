// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createChannelWithManagedCategory, enableManagedCategories, skipIfNoEnterpriseLicense} from './support';

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
});
