// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createChannelWithManagedCategory, enableManagedCategories, skipIfNoEnterpriseLicense} from './support';

test.describe('Managed Channel Categories', () => {
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
});
