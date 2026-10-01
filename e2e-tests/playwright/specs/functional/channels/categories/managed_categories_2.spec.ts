// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createChannelWithManagedCategory,
    enableManagedCategories,
    managedCategorySelectorWrapper,
    setupManagedCategoriesTest,
    skipIfNoEnterpriseLicense,
} from './managed_categories_helpers';

test.describe('Managed Channel Categories', () => {
    /**
     * @objective Verify that a managed category can be assigned to a channel during creation via the new channel modal.
     */
    test('managed category can be assigned when creating a new channel', {tag: '@managed_categories'}, async ({pw}) => {
        await pw.ensureFeatureFlag('ManagedChannelCategories', true);

        // # Initialize setup and enable managed categories
        const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
        await skipIfNoEnterpriseLicense(adminClient);
        await enableManagedCategories();
        await adminClient.addToTeam(team.id, adminUser.id);

        // # Log in and open the new channel modal
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        const displayName = `New Managed ${Date.now()}`;
        await newChannelModal.fillDisplayName(displayName);

        // * Verify managed category selector is visible
        const managedWrapper = managedCategorySelectorWrapper(newChannelModal.container);
        const managedSelector = managedWrapper.locator('.CategorySelector__control');
        await expect(managedSelector).toBeVisible();

        // # Select a new managed category and create the channel
        await managedSelector.click();
        const input = managedWrapper.getByRole('combobox');
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
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel with a managed category
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories();
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
            await pw.waitUntil(async () => managedCategory.isVisible().catch(() => false), {timeout: 15000});
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
            await pw.ensureFeatureFlag('ManagedChannelCategories', true);

            // # Initialize setup and create a channel with a managed category (without adding the user)
            const {adminUser, adminClient, team, user} = await setupManagedCategoriesTest(pw);
            await skipIfNoEnterpriseLicense(adminClient);
            await enableManagedCategories();
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
});
