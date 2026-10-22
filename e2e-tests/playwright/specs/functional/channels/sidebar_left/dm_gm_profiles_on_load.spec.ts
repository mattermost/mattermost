// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

// GET /api/v4/users/me/channels and GET /api/v4/users/me/teams/{team_id}/channels, the two requests
// that populate the sidebar's channels. Anchored so the sibling /channels/members and
// /channels/categories routes are left alone.
const CHANNEL_LIST_PATH = /^\/api\/v4\/users\/me\/(channels|teams\/[^/]+\/channels)$/;

// GET /api/v4/users/{user_id}/channel_members, the request that populates the user's channel
// memberships. The DM half of loadProfilesForSidebar reads getMyChannels, which filters the channels
// through these, so it needs them as much as it needs the channels themselves.
const CHANNEL_MEMBERS_PATH = /^\/api\/v4\/users\/[^/]+\/channel_members$/;

// GET /api/v4/users, the paged "load some profiles" request.
const USER_PAGE_PATH = /^\/api\/v4\/users$/;

const REQUEST_DELAY_MS = 4000;

type Scenario = Awaited<ReturnType<typeof setupSidebarProfiles>>;

/**
 * Sets up a favorited DM and a GM whose members appear nowhere else in the loaded state, then logs
 * in without navigating anywhere yet.
 */
async function setupSidebarProfiles(pw: PlaywrightExtended) {
    const {adminClient, user, userClient, team} = await pw.initSetup();

    // # Create the teammates for the DM and the GM. They are deliberately left out of the
    // channel the test lands on, so that nothing else pulls their profiles into the store.
    const [dmUser, gmUser1, gmUser2] = await adminClient.createUsers(team.id, 3, 'sidebar-profile');

    const dmChannel = await userClient.createDirectChannel([user.id, dmUser.id]);
    const gmChannel = await userClient.createGroupChannel([user.id, gmUser1.id, gmUser2.id]);

    // # Land on a channel containing only the test user, so the current channel's member
    // profiles can't mask a missing DM or GM profile.
    const landingChannel = await adminClient.createPublicChannel(team.id, 'Sidebar Profiles');
    await adminClient.addToChannel(user.id, landingChannel.id);

    // # Make both conversations visible in the sidebar
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'direct_channel_show', name: dmUser.id, value: 'true'},
        {user_id: user.id, category: 'group_channel_show', name: gmChannel.id, value: 'true'},
    ]);

    // # Move the DM into Favorites. A DM whose teammate profile is missing is filtered out of
    // the Direct Messages category, so only another category surfaces the blank row.
    const {categories} = await userClient.getChannelCategories(user.id, team.id);
    const favorites = categories.find((category) => category.type === 'favorites');
    const directMessages = categories.find((category) => category.type === 'direct_messages');
    if (!favorites || !directMessages) {
        throw new Error('Expected the default Favorites and Direct Messages categories to exist');
    }
    await userClient.updateChannelCategories(user.id, team.id, [
        {...favorites, channel_ids: [dmChannel.id]},
        {
            ...directMessages,
            channel_ids: directMessages.channel_ids.filter((channelId) => channelId !== dmChannel.id),
        },
    ]);

    const {channelsPage, page} = await pw.testBrowser.login(user);

    // # Empty the first page of users, which on a server this small would otherwise return
    // every teammate and load the DM profile by accident.
    await page.route(
        (url) => USER_PAGE_PATH.test(url.pathname),
        (route) => route.fulfill({status: 200, contentType: 'application/json', body: '[]'}),
    );

    return {channelsPage, page, team, landingChannel, dmUser, dmChannel, gmChannel};
}

/**
 * Delays the requests matching the given path so the sidebar categories always win the race.
 */
async function delayRequests({page}: Scenario, path: RegExp) {
    await page.route(
        (url) => path.test(url.pathname),
        async (route) => {
            await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
            await route.continue();
        },
    );
}

/**
 * Loads the landing channel. Nothing in the sidebar is clicked afterwards, because navigating to a
 * channel reloads these profiles and would hide the bug.
 */
async function gotoLandingChannel({channelsPage, team, landingChannel}: Scenario) {
    await channelsPage.goto(team.name, landingChannel.name);
    await channelsPage.toBeVisible();
}

/**
 * @objective Verify that direct and group message channels in the sidebar render the teammate's
 * name and the member count when the channel list arrives after the sidebar categories.
 *
 * @precondition
 * Two conditions that occur naturally on a busy account are forced here so the test is
 * deterministic on a small server:
 *
 * 1. The channel list requests are delayed so the sidebar categories always resolve first. That
 *    ordering is what leaves the DM and GM profiles unloaded, and it happens on its own once an
 *    account has enough channels for the channel list to be the slower of the two.
 * 2. The first page of GET /api/v4/users is emptied. On a server with a handful of users that one
 *    request happens to return every teammate and hides the missing DM profile; on a real server
 *    the teammates are nowhere near the first page.
 */
test(
    'renders DM and GM sidebar rows when the channel list arrives after the categories',
    {tag: '@sidebar_left'},
    async ({pw}) => {
        const scenario = await setupSidebarProfiles(pw);

        // # Delay the channel list so the sidebar categories always win the race
        await delayRequests(scenario, CHANNEL_LIST_PATH);

        await gotoLandingChannel(scenario);

        const {sidebarLeft} = scenario.channelsPage;

        // * Verify the group message shows how many other members it has instead of 0
        await expect(sidebarLeft.memberCountBadge(scenario.gmChannel.name)).toHaveText('2');

        // * Verify the favorited DM shows the teammate's username instead of rendering an empty row
        await expect(sidebarLeft.item(scenario.dmChannel.name)).toContainText(scenario.dmUser.username);
    },
);

/**
 * @objective Verify that direct and group message channels in the sidebar render the teammate's
 * name and the member count when the channel memberships arrive after the sidebar categories.
 *
 * @precondition
 * Same as the channel list ordering above, except the memberships are the slow request. This is the
 * separate half of the dependency: the channels can all be present and the DM profiles still go
 * unloaded, because getMyChannels filters the channels through the memberships.
 */
test(
    'renders DM and GM sidebar rows when the channel memberships arrive after the categories',
    {tag: '@sidebar_left'},
    async ({pw}) => {
        const scenario = await setupSidebarProfiles(pw);

        // # Delay the channel memberships so the sidebar categories always win the race
        await delayRequests(scenario, CHANNEL_MEMBERS_PATH);

        await gotoLandingChannel(scenario);

        const {sidebarLeft} = scenario.channelsPage;

        // * Verify the group message shows how many other members it has instead of 0
        await expect(sidebarLeft.memberCountBadge(scenario.gmChannel.name)).toHaveText('2');

        // * Verify the favorited DM shows the teammate's username instead of rendering an empty row
        await expect(sidebarLeft.item(scenario.dmChannel.name)).toContainText(scenario.dmUser.username);
    },
);
