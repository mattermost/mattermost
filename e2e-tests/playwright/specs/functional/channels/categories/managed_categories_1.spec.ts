// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createChannelWithManagedCategory,
    managedCategorySelectorWrapper,
    setupManagedCategoriesTest,
} from './managed_categories_helpers';

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that a Channel Admin can assign a managed category to a channel via the channel settings modal,
     * and the category appears in the sidebar with the channel under it.
     */
    test(
        'Channel Admin can assign a managed category via channel settings',
        {tag: '@managed_categories'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup with admin user and enterprise license
            const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
            await pw.skipIfNoLicense();
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
            const managedWrapper = managedCategorySelectorWrapper(channelSettingsModal.container);
            const managedSelector = managedWrapper.locator('.CategorySelector__control');
            await expect(managedSelector).toBeVisible();

            // # Click the selector, type a new category name, and select "Create new category"
            await managedSelector.click();
            const input = managedWrapper.getByRole('combobox');
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
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
            await pw.skipIfNoLicense();
            await adminClient.addToTeam(team.id, adminUser.id);

            const channel = await createChannelWithManagedCategory(adminClient, team.id, 'Removable', 'remove');
            await adminClient.addToChannel(adminUser.id, channel.id);

            // # Log in and navigate to the channel
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Verify the managed category is visible in the sidebar.
            // Use waitUntil because fetchManagedCategories is async (two API calls:
            // getPropertyFields then getManagedCategories) and may take a moment.
            const sidebar = channelsPage.sidebarLeft.container;
            await pw.waitUntil(
                async () =>
                    sidebar
                        .getByText('Removable')
                        .isVisible()
                        .catch(() => false),
                {timeout: 15000},
            );
            await expect(sidebar.getByText('Removable')).toBeVisible();

            // # Open channel settings and click the clear button to remove the category
            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.openInfoTab();

            const clearButton = managedCategorySelectorWrapper(channelSettingsModal.container).locator(
                '.CategorySelector__clear-indicator',
            );
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
});
