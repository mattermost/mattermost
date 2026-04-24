// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createChannelWithManagedCategory,
    disableManagedCategories,
    enableManagedCategories,
    skipIfNoEnterpriseLicense,
} from './support';

test.describe('Managed Channel Categories', () => {
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
});
