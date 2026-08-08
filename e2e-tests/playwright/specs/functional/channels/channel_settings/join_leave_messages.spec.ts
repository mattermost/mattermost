// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Verify per-channel suppression of join/leave system messages via
 * the Configuration tab toggle in Channel Settings.
 *
 * The toggle controls `DisableJoinLeaveMessages` on the channel:
 *   - Toggle ON  (active class)    → messages shown (DisableJoinLeaveMessages = false)
 *   - Toggle OFF (no active class) → messages hidden (DisableJoinLeaveMessages = true)
 *
 * Join system posts are generated server-side when a user is added to a
 * channel, so tests use `adminClient.addToChannel()` to produce them.
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

test.describe('Channel Settings Modal - Join/Leave System Messages', () => {
    /**
     * @objective Verify the join/leave messages toggle is visible in Channel Settings
     * Configuration tab and defaults to ON (messages shown).
     */
    test('toggle is visible and defaults to ON (messages shown)', {tag: '@channel_settings'}, async ({pw}) => {
        // # Initialize test setup
        const {adminUser, adminClient, team} = await pw.initSetup();

        // # Create a public channel via API
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `jl-toggle-default-${Date.now()}`,
            display_name: 'JL Toggle Default',
            type: 'O',
        } as any);

        // # Login as admin and navigate to the channel
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Open Channel Settings and navigate to Configuration tab
        const channelSettings = await channelsPage.openChannelSettings();
        const configSettings = await channelSettings.openConfigurationTab();

        // * Toggle is visible
        await expect(configSettings.joinLeaveMessagesToggle).toBeVisible();

        // * Toggle defaults to ON (active class present = messages shown)
        const classes = await configSettings.joinLeaveMessagesToggle.getAttribute('class');
        expect(classes).toContain('active');

        await channelSettings.close();
    });

    /**
     * @objective Verify that disabling the join/leave messages toggle hides join system
     * posts from the channel timeline while keeping regular messages visible.
     */
    test(
        'disabling the toggle hides join system posts from the channel timeline',
        {tag: '@channel_settings'},
        async ({pw}) => {
            // # Initialize test setup
            const {adminUser, adminClient, team} = await pw.initSetup();

            // # Create a public channel via API
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `jl-disable-${Date.now()}`,
                display_name: 'JL Disable Test',
                type: 'O',
            } as any);

            // # Create a second user, add to team and channel to produce a join system post
            const secondUser = await pw.createNewUserProfile(adminClient, {
                prefix: 'jl2',
                disableTutorial: true,
                disableOnboarding: true,
            });
            await adminClient.addToTeam(team.id, secondUser.id);

            // # Post a normal message to verify it stays visible when system posts are hidden
            await adminClient.createPost({
                channel_id: channel.id,
                message: 'This is a regular message that should remain visible',
            } as any);

            // # Add the second user to the channel — this triggers a server-side join system post
            await adminClient.addToChannel(secondUser.id, channel.id);

            // # Login as admin and navigate to the channel
            const {page} = await pw.testBrowser.login(adminUser);
            const channelsPage = new ChannelsPage(page);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * The join system post is visible in the timeline before disabling
            await expect(
                channelsPage.centerView.container.getByText('joined the channel'), // EN locale
            ).toBeVisible({timeout: pw.duration.ten_sec});

            // # Open Channel Settings → Configuration tab and disable join/leave messages
            const channelSettings = await channelsPage.openChannelSettings();
            const configSettings = await channelSettings.openConfigurationTab();
            await configSettings.disableJoinLeaveMessages();
            await configSettings.save();
            await channelSettings.close();

            // * The join system post is no longer visible — wait for post-list re-fetch after ETag bust
            await expect(
                channelsPage.centerView.container.getByText('joined the channel'), // EN locale
            ).not.toBeVisible({timeout: pw.duration.ten_sec});

            // * Normal messages are still visible
            await expect(
                channelsPage.centerView.container
                    .getByTestId('postContent')
                    .getByText('This is a regular message that should remain visible'),
            ).toBeVisible();
        },
    );

    /**
     * @objective Verify that re-enabling the join/leave messages toggle restores
     * previously hidden join system posts (two-way door behavior).
     */
    test(
        're-enabling the toggle restores hidden join system posts (two-way door)',
        {tag: '@channel_settings'},
        async ({pw}) => {
            // # Initialize test setup
            const {adminUser, adminClient, team} = await pw.initSetup();

            // # Create a public channel via API
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `jl-reenable-${Date.now()}`,
                display_name: 'JL Re-enable Test',
                type: 'O',
            } as any);

            // # Create a second user, add to team and channel to produce a join system post
            const secondUser = await pw.createNewUserProfile(adminClient, {
                prefix: 'jl3',
                disableTutorial: true,
                disableOnboarding: true,
            });
            await adminClient.addToTeam(team.id, secondUser.id);
            await adminClient.addToChannel(secondUser.id, channel.id);

            // # Login as admin and navigate to the channel
            const {page} = await pw.testBrowser.login(adminUser);
            const channelsPage = new ChannelsPage(page);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // # Disable join/leave messages and save
            let channelSettings = await channelsPage.openChannelSettings();
            let configSettings = await channelSettings.openConfigurationTab();
            await configSettings.disableJoinLeaveMessages();
            await configSettings.save();
            await channelSettings.close();

            // * Join system post is hidden after disabling — wait for post-list re-fetch
            await expect(
                channelsPage.centerView.container.getByText('joined the channel'), // EN locale
            ).not.toBeVisible({timeout: pw.duration.ten_sec});

            // # Re-open Channel Settings → Configuration tab and re-enable join/leave messages
            channelSettings = await channelsPage.openChannelSettings();
            configSettings = await channelSettings.openConfigurationTab();
            await configSettings.enableJoinLeaveMessages();
            await configSettings.save();
            await channelSettings.close();

            // * Join system post is visible again after re-enabling
            await expect(
                channelsPage.centerView.container.getByText('joined the channel'), // EN locale
            ).toBeVisible({timeout: pw.duration.ten_sec});
        },
    );
});
