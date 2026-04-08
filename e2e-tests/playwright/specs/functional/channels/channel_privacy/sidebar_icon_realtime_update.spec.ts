// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test(
    'sidebar icon updates from globe to lock when channel converted to private via API',
    {tag: ['@channels', '@channel_privacy']},
    async ({pw}) => {
        // # Initialize setup
        const {adminClient, user, team} = await pw.initSetup();

        // # Create a public channel
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                displayName: 'Privacy WS Test',
                type: 'O',
            }),
        );
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in user and navigate to the channel
        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify sidebar shows globe icon (public channel)
        const sidebarItem = page.locator(`#sidebarItem_${channel.name}`);
        await expect(sidebarItem).toBeVisible();
        await expect(sidebarItem.locator('.icon-globe')).toBeVisible();
        await expect(sidebarItem.locator('.icon-lock-outline')).not.toBeVisible();

        // # Convert channel to private via admin API (simulates mmctl)
        await adminClient.updateChannelPrivacy(channel.id, 'P');

        // * Verify sidebar icon updates to lock without page refresh
        await expect(sidebarItem.locator('.icon-lock-outline')).toBeVisible({timeout: 10000});
        await expect(sidebarItem.locator('.icon-globe')).not.toBeVisible();
    },
);

test(
    'sidebar icon updates from lock to globe when channel converted to public via API',
    {tag: ['@channels', '@channel_privacy']},
    async ({pw}) => {
        // # Initialize setup
        const {adminClient, user, team} = await pw.initSetup();

        // # Create a private channel
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                displayName: 'Privacy WS Test P2O',
                type: 'P',
            }),
        );
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in user and navigate to the channel
        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify sidebar shows lock icon (private channel)
        const sidebarItem = page.locator(`#sidebarItem_${channel.name}`);
        await expect(sidebarItem).toBeVisible();
        await expect(sidebarItem.locator('.icon-lock-outline')).toBeVisible();
        await expect(sidebarItem.locator('.icon-globe')).not.toBeVisible();

        // # Convert channel to public via admin API (simulates mmctl)
        await adminClient.updateChannelPrivacy(channel.id, 'O');

        // * Verify sidebar icon updates to globe without page refresh
        await expect(sidebarItem.locator('.icon-globe')).toBeVisible({timeout: 10000});
        await expect(sidebarItem.locator('.icon-lock-outline')).not.toBeVisible();
    },
);
