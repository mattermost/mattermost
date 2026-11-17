// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test, watchElementSize} from '@mattermost/playwright-lib';

// The intro picks its action buttons based on whether the workspace has fewer than 10 users
const testCases = [
    {name: 'fewer than 10 users', totalUsersCount: 3, expectedButton: /Invite others to the workspace/},
    {name: '10 or more users', totalUsersCount: 50, expectedButton: /^Favorite$/},
];

for (const {name, totalUsersCount, expectedButton} of testCases) {
    /**
     * @objective Verify the channel intro does not change size when the total user count it depends on loads after
     * the channel posts
     */
    test(
        `keeps the channel intro size stable when the user count loads late with ${name}`,
        {tag: '@post_list'},
        async ({pw}) => {
            const {adminClient, team, user, userClient} = await pw.initSetup();

            const channel = await userClient.createChannel({
                team_id: team.id,
                name: `channel-intro-${pw.random.id()}`,
                display_name: 'Channel intro layout',
                type: 'O',
            });

            // # Delete the join messages so that only the channel intro is shown
            const posts = await adminClient.getPosts(channel.id);
            for (const postId of posts.order) {
                await adminClient.deletePost(postId);
            }

            const {channelsPage, page} = await pw.testBrowser.login(user);
            const sizeWatcher = await watchElementSize(page, 'channelIntro');

            // # Hold back the total user count until the channel has rendered
            const releaseUsersStats = await holdBackUsersStats(page, totalUsersCount);

            // # Open the channel
            await channelsPage.goto(team.name, channel.name);
            await expect(
                channelsPage.centerView.channelIntro.or(channelsPage.centerView.postListLoading),
            ).toBeVisible();

            // # Let the total user count load
            releaseUsersStats();

            // * Verify that the intro shows the action buttons for the user count
            await expect(
                channelsPage.centerView.channelIntro.getByRole('button', {name: expectedButton}),
            ).toBeVisible();

            // * Verify that the intro was only ever rendered at one size
            expect(await sizeWatcher.isWatchingElement()).toBe(true);
            expect(await sizeWatcher.getObservations()).toHaveLength(1);
        },
    );
}

/** Delay the total user count response until the returned function is called, then respond with the given count */
async function holdBackUsersStats(page: Page, totalUsersCount: number) {
    let releaseUsersStats = () => {};
    const usersStatsReleased = new Promise<void>((resolve) => {
        releaseUsersStats = resolve;
    });

    await page.route(
        (url) => url.pathname.endsWith('/api/v4/users/stats'),
        async (route) => {
            await usersStatsReleased;
            await route.fulfill({json: {total_users_count: totalUsersCount}});
        },
    );

    return releaseUsersStats;
}
