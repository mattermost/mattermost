// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify archived channel icons display correctly for public and private channels in various UI contexts
 */
test(
    'displays archive icons for public and private channels in sidebar',
    {tag: ['@visual', '@archived_channels', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Initialize setup and create test channels
        const {team, user, adminClient} = await pw.initSetup();

        // # Create public and private channels
        const publicChannel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'public-to-archive',
                displayName: 'Public Archive Test',
                type: 'O',
            }),
        );

        const privateChannel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'private-to-archive',
                displayName: 'Private Archive Test',
                type: 'P',
            }),
        );

        // # Archive both channels
        await adminClient.deleteChannel(publicChannel.id);
        await adminClient.deleteChannel(privateChannel.id);

        // # Log in user
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit town square to ensure we're in a stable state
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open browse channels modal to show archived channels
        await page.keyboard.press('Control+K');
        await page.waitForTimeout(500);

        // # Type to search for archived channels
        await page.keyboard.type('archive');
        await page.waitForTimeout(500);

        // # Hide dynamic content
        await pw.hideDynamicChannelsContent(page);

        // * Verify channel switcher shows both archived channels with correct icons
        const testArgs = {page, browserName, viewport};
        await pw.matchSnapshot(testInfo, testArgs);
    },
);

/**
 * @objective Verify archived channel icons display correctly in admin console channel list
 */
test(
    'displays archive icons in admin console channel list',
    {tag: ['@visual', '@archived_channels', '@admin_console', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Initialize setup with admin user
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Create public and private channels
        const publicChannel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'admin-public-archive',
                displayName: 'Admin Public Archive',
                type: 'O',
            }),
        );

        const privateChannel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'admin-private-archive',
                displayName: 'Admin Private Archive',
                type: 'P',
            }),
        );

        // # Archive both channels
        await adminClient.deleteChannel(publicChannel.id);
        await adminClient.deleteChannel(privateChannel.id);

        // # Log in as admin
        const {page} = await pw.testBrowser.login(adminUser);

        // # Navigate to admin console channels list
        await page.goto('/admin_console/user_management/channels');
        await page.waitForTimeout(1000);

        // # Wait for channel list to load
        await expect(page.locator('.DataGrid')).toBeVisible({timeout: 10000});

        // # Search for our test channels to bring them into view
        await page.fill('[data-testid="searchInput"]', 'Admin');
        await page.waitForTimeout(500);

        // * Verify both archived channels are visible with correct icons
        const testArgs = {page, browserName, viewport};
        await pw.matchSnapshot(testInfo, testArgs);
    },
);

/**
 * @objective Verify archived private channel icon displays in channel header when viewing archived channel
 */
test(
    'displays archive icon in channel header for archived private channel',
    {tag: ['@visual', '@archived_channels', '@channel_header', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Initialize setup
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Create a private channel
        const privateChannel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'private-header-test',
                displayName: 'Private Header Test',
                type: 'P',
            }),
        );

        // # Archive the channel
        await adminClient.deleteChannel(privateChannel.id);

        const {page, channelsPage} = await pw.testBrowser.login(adminUser);

        // # Visit the archived channel directly
        await channelsPage.goto(team.name, privateChannel.name);

        // # Wait for channel header to load (archived channels don't have post-create)
        await expect(page.locator('.channel-header')).toBeVisible();

        // # Verify archived channel message is visible
        await expect(page.locator('#channelArchivedMessage')).toBeVisible();

        // # Hide dynamic content
        await pw.hideDynamicChannelsContent(page);

        // # Focus on channel header area for snapshot
        const headerElement = page.locator('.channel-header');
        await expect(headerElement).toBeVisible();

        // * Verify channel header shows archive-lock icon for private archived channel
        const testArgs = {page, browserName, viewport};
        await pw.matchSnapshot(testInfo, testArgs);
    },
);
