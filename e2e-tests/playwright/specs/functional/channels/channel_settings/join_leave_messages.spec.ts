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
     * @objective Verify that a user added to a channel with DisableJoinLeaveMessages=true
     * receives a sidebar mention count badge (blue dot) even though the add-to-channel
     * system post is suppressed from the timeline.
     */
    test(
        'added user receives sidebar mention badge when join/leave messages are disabled',
        {tag: '@channel_settings'},
        async ({pw}) => {
            // # Initialize test setup
            const {adminClient, team} = await pw.initSetup();

            // # Create a public channel and immediately disable join/leave messages
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `jl-added-badge-${Date.now()}`,
                display_name: 'JL Added Badge Test',
                type: 'O',
            } as any);
            await adminClient.patchChannel(channel.id, {disable_join_leave_messages: true} as any);

            // # Create a second user and add them to the team (not the channel yet)
            const secondUser = await pw.createNewUserProfile(adminClient, {
                prefix: 'jl-badge',
                disableTutorial: true,
                disableOnboarding: true,
            });
            await adminClient.addToTeam(team.id, secondUser.id);

            // # Login as secondUser and navigate to a channel so the app fully loads and
            // WS connection is established before the add-to-channel event fires
            const {page: secondPage} = await pw.testBrowser.login(secondUser);
            const secondChannelsPage = new ChannelsPage(secondPage);
            await secondChannelsPage.goto(team.name, 'town-square');
            await secondChannelsPage.toBeVisible();

            // # Admin adds secondUser to the channel — this triggers a suppressed add-to-channel
            // system post; IncrementMentionCount runs instead of SendNotifications
            await adminClient.addToChannel(secondUser.id, channel.id);

            // * secondUser's sidebar should show the new channel with a mention count badge
            const badge = secondChannelsPage.sidebarLeft.unreadMentionsBadge(channel.name);
            await expect(badge).toBeVisible({timeout: pw.duration.ten_sec});

            // * The channel timeline should NOT contain an add-to-channel system post
            await secondChannelsPage.sidebarLeft.goToItem(channel.name);
            await expect(
                secondChannelsPage.centerView.container.getByText('added to the channel'),
            ).not.toBeVisible({timeout: pw.duration.ten_sec});
        },
    );

    /**
     * @objective Verify that toggling DisableJoinLeaveMessages live-reloads the channel
     * post list for all users currently viewing the channel (Option 7 / WS reload).
     * A second user already viewing the channel should see join system posts appear or
     * disappear in real time when the admin changes the setting.
     */
    test(
        'toggling join/leave messages live-reloads the channel for other viewers',
        {tag: '@channel_settings'},
        async ({pw}) => {
            // # Initialize test setup
            const {adminUser, adminClient, team} = await pw.initSetup();

            // # Create a public channel and add a second user to produce a join system post
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `jl-ws-reload-${Date.now()}`,
                display_name: 'JL WS Reload Test',
                type: 'O',
            } as any);

            const secondUser = await pw.createNewUserProfile(adminClient, {
                prefix: 'jl-ws',
                disableTutorial: true,
                disableOnboarding: true,
            });
            await adminClient.addToTeam(team.id, secondUser.id);
            await adminClient.addToChannel(secondUser.id, channel.id);

            // # Login as secondUser and navigate to the channel
            const {page: secondPage} = await pw.testBrowser.login(secondUser);
            const secondChannelsPage = new ChannelsPage(secondPage);
            await secondChannelsPage.goto(team.name, channel.name);
            await secondChannelsPage.toBeVisible();

            // * secondUser sees the join system post in the channel
            await expect(
                secondChannelsPage.centerView.container.getByText('joined the channel'),
            ).toBeVisible({timeout: pw.duration.ten_sec});

            // # Admin logs in and disables join/leave messages from their browser
            const {page: adminPage} = await pw.testBrowser.login(adminUser);
            const adminChannelsPage = new ChannelsPage(adminPage);
            await adminChannelsPage.goto(team.name, channel.name);
            await adminChannelsPage.toBeVisible();

            const channelSettings = await adminChannelsPage.openChannelSettings();
            const configSettings = await channelSettings.openConfigurationTab();
            await configSettings.disableJoinLeaveMessages();
            await configSettings.save();
            await channelSettings.close();

            // * secondUser's view updates in real time — join post disappears without a page reload
            await expect(
                secondChannelsPage.centerView.container.getByText('joined the channel'),
            ).not.toBeVisible({timeout: pw.duration.ten_sec});
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
