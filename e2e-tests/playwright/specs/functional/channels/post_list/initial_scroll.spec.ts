// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Page} from '@playwright/test';

import {expect, setupFileServer, test} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightClient4} from '@mattermost/playwright-lib';

test.describe('Post list initial scroll', () => {
    let adminClient: PlaywrightClient4;
    let adminUser: UserProfile;
    let userClient: PlaywrightClient4;
    let user: UserProfile;

    let team: Team;
    let channel: ServerChannel;

    let channelsPage: ChannelsPage;
    let page: Page;

    let fileServerUrl: string;
    setupFileServer().then((serverUrl) => {
        fileServerUrl = serverUrl;
    });

    test.beforeEach(async ({pw}) => {
        ({adminClient, adminUser, team, user, userClient} = await pw.initSetup());

        channel = await userClient.createChannel({
            team_id: team.id,
            name: `post-list-${pw.random.id()}`,
            display_name: 'Post list scroll position',
            type: 'O',
        });

        await adminClient.addToChannel(adminUser.id, channel.id);

        ({channelsPage, page} = await pw.testBrowser.login(user));
    });

    test.describe('empty channel', () => {
        test.beforeEach(async () => {
            // # Delete the "User has joined the channel" posts to ensure that the channel is completely empty
            const posts = await adminClient.getPosts(channel.id, 0, 1);
            for (const postId of posts.order) {
                await adminClient.deletePost(postId);
            }
        });

        test('should stay at the bottom during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.channelIntro.waitFor();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with less than a screen of posts', () => {
        test.beforeEach(async () => {
            // # Make a few posts as the current user so that the channel stays read
            for (let i = 0; i < 3; i++) {
                await userClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the bottom during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('unread channel with less than a screen of text posts', () => {
        test.beforeEach(async () => {
            // # Make a post as the current user to ensure that the New Messages line will show up
            await userClient.createPost(makeTestPost(0));

            // # Make a few posts as the admin so that the channel becomes unread
            for (let i = 0; i < 3; i++) {
                await adminClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the bottom during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            await page.waitForLoadState('networkidle');

            // * Verify that the channel starts as unread
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the New Messages line is still visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with a page of text posts', () => {
        test.beforeEach(async () => {
            // # Make a few posts as the current user so that the channel stays read
            for (let i = 0; i < 60; i++) {
                await userClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the bottom during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('unread channel with a page of text posts', () => {
        test.beforeEach(async () => {
            // # Make some posts as the current user and then some more as the admin so the channel is partially unread
            for (let i = 0; i < 20; i++) {
                await userClient.createPost(makeTestPost(i));
            }

            for (let i = 0; i < 20; i++) {
                await adminClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // * Verify that the channel starts as unread
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the New Messages line is still visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with multiple pages of text posts', () => {
        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 120; i++) {
                await userClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the bottom during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('unread channel with multiple pages of text posts', () => {
        test.beforeEach(async () => {
            // # Make some posts as the current user and then some more as the admin so the channel is partially unread
            for (let i = 0; i < 80; i++) {
                await userClient.createPost(makeTestPost(i));
            }

            for (let i = 0; i < 80; i++) {
                await adminClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // * Verify that the channel starts as unread
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the New Messages line is still visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with multiple pages of image attachments', () => {
        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 120; i++) {
                await userClient.createTestPost(makeTestPost(i), ['mattermost.png']);
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('unread read channel with multiple pages of image attachments', () => {
        test.beforeEach(async () => {
            // # Make some posts as the current user and then some more as the admin so the channel is partially unread
            for (let i = 0; i < 80; i++) {
                await userClient.createTestPost(makeTestPost(i), ['mattermost.png']);
            }

            for (let i = 0; i < 80; i++) {
                await adminClient.createTestPost(makeTestPost(i), ['mattermost.png']);
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // * Verify that the channel starts as unread
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the New Messages line is still visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with multiple pages of markdown images', () => {
        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 120; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `![test image](${fileServerUrl}/mattermost.png)`,
                });
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('unread read channel with multiple pages of markdown images', () => {
        test.beforeEach(async () => {
            // # Make some posts as the current user and then some more as the admin so the channel is partially unread
            for (let i = 0; i < 80; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `![test image](${fileServerUrl}/mattermost.png)`,
                });
            }

            for (let i = 0; i < 80; i++) {
                await adminClient.createTestPost({
                    channel_id: channel.id,
                    message: `![test image](${fileServerUrl}/mattermost.png)`,
                });
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // * Verify that the channel starts as unread
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the New Messages line is still visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with multiple pages of link previews', () => {
        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 120; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `${fileServerUrl}/opengraph.html`,
                });
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('unread read channel with multiple pages of link previews', () => {
        test.beforeEach(async () => {
            // # Make some posts as the current user and then some more as the admin so the channel is partially unread
            for (let i = 0; i < 80; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `${fileServerUrl}/opengraph.html`,
                });
            }

            for (let i = 0; i < 80; i++) {
                await adminClient.createTestPost({
                    channel_id: channel.id,
                    message: `${fileServerUrl}/opengraph.html`,
                });
            }
        });

        test('should stay at the New Messages line during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // * Verify that the channel starts as unread
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);

            // # Switch to the channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify that the New Messages line is still visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    // Helpers

    function makeTestPost(n: number) {
        return {
            channel_id: channel.id,
            message: `message ${n}\nsecond line\nthird line`,
        };
    }

    async function waitForScrollToSettle(watcher: PostListScrollWatcher) {
        await channelsPage.centerView.toBeVisible();
        await page.waitForLoadState('networkidle');

        // # Wait until the post list hasn't scrolled for 500ms before returning results
        return watcher.waitForObservations(500);
    }
});

type ScrollObservation = {
    distanceFromBottom: number | null;
    clientHeight: number | null;
    scrollTop: number | null;
    scrollHeight: number | null;
    containerTop: number | null;
    separatorTop: number | null;
    separatorViewportTop: number | null;
    at: number;
};

type PostListScrollWatcher = {
    /** Waits until the scroll position settles before returning all observations. */
    waitForObservations: (quietMs: number) => Promise<ScrollObservation[]>;
};

/**
 * Installs a watcher that records the scroll position of the post list for the given channel.
 */
async function watchPostListScroll(page: Page, channelId: string): Promise<PostListScrollWatcher> {
    const SCROLL_WATCHER_KEY = 'postListScrollWatcher';

    await page.addInitScript(
        ([key, channelId]) => {
            type WatcherState = {observations: ScrollObservation[]; lastKey: string};
            const state: WatcherState = {observations: [], lastKey: ''};
            (window as unknown as Record<string, WatcherState>)[key] = state;

            const sample = () => {
                const container = document.querySelector(
                    `#postListContent[data-channel-id="${channelId}"] #postListScrollContainer`,
                );

                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;

                    const separator = document.querySelector('.NotificationSeparator');
                    const separatorViewportTop = separator ? separator.getBoundingClientRect().top : null;
                    const separatorTop =
                        separator && separatorViewportTop !== null ? separatorViewportTop - containerRect.top : null;

                    const observation = {
                        distanceFromBottom,
                        clientHeight: container.clientHeight,
                        scrollTop: container.scrollTop,
                        scrollHeight: container.scrollHeight,
                        containerTop: containerRect.top,
                        separatorTop,
                        separatorViewportTop,
                        at: performance.now(),
                    };

                    const dedupeKey = [
                        observation.distanceFromBottom,
                        observation.clientHeight,
                        observation.scrollTop,
                        observation.scrollHeight,
                        observation.containerTop,
                        observation.separatorTop,
                    ].join('|');

                    if (dedupeKey !== state.lastKey) {
                        state.lastKey = dedupeKey;
                        state.observations.push(observation);
                    }
                }

                requestAnimationFrame(sample);
            };

            requestAnimationFrame(sample);
        },
        [SCROLL_WATCHER_KEY, channelId],
    );

    const getObservations = async () => {
        return page.evaluate((key) => {
            const state = (window as unknown as Record<string, {observations: ScrollObservation[]}>)[key];
            return state ? state.observations : [];
        }, SCROLL_WATCHER_KEY);
    };

    const waitForObservations = async (quietMs = 750) => {
        await expect
            .poll(
                async () => {
                    const observations = await getObservations();
                    if (observations.length === 0) {
                        return false;
                    }
                    const now = await page.evaluate(() => Math.round(performance.now()));
                    return now - observations[observations.length - 1].at >= quietMs;
                },
                {timeout: 5000, intervals: [100, 200, 300]},
            )
            .toBe(true);

        return getObservations();
    };

    return {waitForObservations};
}
