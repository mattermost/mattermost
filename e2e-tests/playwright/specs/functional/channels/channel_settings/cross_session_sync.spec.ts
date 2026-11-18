// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {expect, settle, test, type App, type PlaywrightExtended, Api} from '@mattermost/playwright-lib';

/** Creates a public channel from the sidebar's "+" menu and returns the created channel. */
async function createPublicChannel(app: App, displayName: string) {
    await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.createChannelMenuItem);
    const modal = await app.lhs.browseOrAddMenu.createChannelMenuItem.clickTo(app.newChannelModal);
    await modal.name.container.fill(displayName);
    const channel = await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
    await expect(app.channelHeader.openMenuButton).toContainText(displayName);
    return channel;
}

/** Logs the user in to a new browser session on Town Square. */
async function openSession(pw: PlaywrightExtended, user: UserProfile, team: {name: string}) {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    return app;
}

/**
 * @objective Verify that creating and archiving a public channel in one browser session is synced in
 * real time to another session of the same user.
 */
test('MM-T837 syncs public channel create and archive across sessions', {tag: '@channel_settings'}, async ({pw}) => {
    const {user, team, townSquare} = await pw.initSetup();

    // # Log in as the same user in two separate browser sessions
    const first = await openSession(pw, user, team);
    const second = await openSession(pw, user, team);

    // # Create a public channel in the first session
    const channel = await createPublicChannel(first, `RF ${pw.random.id()}`);

    // * Verify the new channel appears in the sidebar of both sessions
    await expect(first.lhs.channelList.channel(channel).container).toBeVisible();
    await expect(second.lhs.channelList.channel(channel).container).toBeVisible();

    // # Archive the channel in the first session, then navigate away from the archived channel
    await first.channelHeader.openMenuButton.clickTo(first.channelHeader.menu.archiveChannelMenuItem);
    const archive = await first.channelHeader.menu.archiveChannelMenuItem.clickTo(first.deleteChannelModal);
    await settle(archive.confirmButton, {wait: Api.DeleteChannel}).click();
    await first.lhs.channelList.channel(townSquare).container.click();

    // * Verify the channel is removed from the sidebar of both sessions
    await expect(first.lhs.channelList.channel(channel).container).not.toBeVisible();
    await expect(second.lhs.channelList.channel(channel).container).not.toBeVisible();
});

/**
 * @objective Verify that leaving a channel in one browser session removes it from the sidebar of another
 * session that is viewing a different channel, without disrupting that other session's current view.
 */
test(
    'MM-T892 leaving a channel syncs to another session viewing a different channel',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {user, team, townSquare, offTopic} = await pw.initSetup();

        // # Log in as the same user in two separate browser sessions
        const first = await openSession(pw, user, team);
        const second = await openSession(pw, user, team);

        // # Create a public channel in the first session
        const channel = await createPublicChannel(first, `Leave ${pw.random.id()}`);

        // * Verify the new channel appears in the second session's sidebar
        await expect(second.lhs.channelList.channel(channel).container).toBeVisible();

        // # Move the second session to a different channel
        await second.lhs.channelList.channel(offTopic).container.click();
        await expect(second.page).toHavePath(second.channelsPage.pathFor({team, channel: offTopic}));
        await expect(second.channelHeader.openMenuButton).toContainText(offTopic.display_name);

        // # Leave the channel from the first session while still viewing it
        await first.channelHeader.openMenuButton.clickTo(first.channelHeader.menu.archiveChannelMenuItem);
        await first.channelHeader.menu.leaveChannelMenuItem.click();

        // * Verify the first session is redirected to the default channel and the channel is gone from its sidebar
        await expect(first.page).toHavePath(first.channelsPage.pathFor({team, channel: townSquare}));
        await expect(first.channelHeader.openMenuButton).toContainText(townSquare.display_name);
        await expect(first.lhs.channelList.channel(channel).container).not.toBeVisible();

        // * Verify the second session stays on its current channel and the left channel is removed from its sidebar
        await expect(second.lhs.channelList.channel(channel).container).not.toBeVisible();
        await expect(second.page).toHavePath(second.channelsPage.pathFor({team, channel: offTopic}));
        await expect(second.channelHeader.openMenuButton).toContainText(offTopic.display_name);
    },
);

/**
 * @objective Verify that leaving a channel in one session, while another session of the same user is
 * viewing that same channel, redirects both sessions to the default channel and removes it from both sidebars.
 *
 * MM-T2554 covers the same behavior as MM-T2549 and is covered by this test.
 */
test(
    'MM-T2549 MM-T2554 leaving a viewed channel redirects the other session viewing it to Town Square',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {user, team, townSquare} = await pw.initSetup();

        // # Log in as the same user in two separate browser sessions
        const first = await openSession(pw, user, team);
        const second = await openSession(pw, user, team);

        // # Create a public channel in the first session
        const displayName = `Leave ${pw.random.id()}`;
        const channel = await createPublicChannel(first, displayName);

        // # Bring the second session to the same channel
        await expect(second.lhs.channelList.channel(channel).container).toBeVisible();
        await second.lhs.channelList.channel(channel).container.click();
        await expect(second.channelHeader.openMenuButton).toContainText(displayName);

        // # Leave the channel from the first session while both sessions are viewing it
        await first.channelHeader.openMenuButton.clickTo(first.channelHeader.menu.archiveChannelMenuItem);
        await first.channelHeader.menu.leaveChannelMenuItem.click();

        // * Verify the first session is redirected to Town Square and the channel is gone from its sidebar
        await expect(first.page).toHavePath(first.channelsPage.pathFor({team, channel: townSquare}));
        await expect(first.channelHeader.openMenuButton).toContainText(townSquare.display_name);
        await expect(first.lhs.channelList.channel(channel).container).not.toBeVisible();

        // * Verify the second session is also redirected to Town Square and the channel is removed from its sidebar
        await expect(second.page).toHavePath(second.channelsPage.pathFor({team, channel: townSquare}));
        await expect(second.channelHeader.openMenuButton).toContainText(townSquare.display_name);
        await expect(second.lhs.channelList.channel(channel).container).not.toBeVisible();
    },
);
