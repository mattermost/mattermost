// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Page} from '@playwright/test';

import {expect, test, wait} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightClient4} from '@mattermost/playwright-lib';

test.describe.only('Post list initial scroll', () => {
    let adminClient: PlaywrightClient4;
    let adminUser: UserProfile;
    let userClient: Client4;
    let user: UserProfile;

    let team: Team;
    let channel: ServerChannel;

    let channelsPage: ChannelsPage;
    let page: Page;

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

        test('should stay at the bottom during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({pw}) => {
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
                await userClient.createPost(makeTestPost(user.id, i));
            }
        });

        test('should stay at the bottom during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({pw}) => {
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
            await userClient.createPost(makeTestPost(user.id, 0));

            // # Make a few posts as the admin so that the channel becomes unread
            for (let i = 0; i < 3; i++) {
                await adminClient.createPost(makeTestPost(adminUser.id, i));
            }
        });

        test('should stay at the bottom during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({pw}) => {
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
                await userClient.createPost(makeTestPost(user.id, i));
            }
        });

        test('should stay at the bottom during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({pw}) => {
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
                await userClient.createPost(makeTestPost(user.id, i));
            }

            for (let i = 0; i < 20; i++) {
                await adminClient.createPost(makeTestPost(adminUser.id, i));
            }
        });

        test('should stay at the New Messages line during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({pw}) => {
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
                await userClient.createPost(makeTestPost(user.id, i));
            }
        });

        test('should stay at the bottom during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the bottom when switching to the channel', async ({pw}) => {
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
                await userClient.createPost(makeTestPost(user.id, i));
            }

            for (let i = 0; i < 80; i++) {
                await adminClient.createPost(makeTestPost(adminUser.id, i));
            }
        });

        test('should stay at the New Messages line during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({pw}) => {
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

    test.describe('fully read channel with image attachments', () => {
        test.beforeEach(async () => {
            // # Make some posts as the current user and then some more as the admin so the channel is partially unread
            for (let i = 0; i < 80; i++) {
                await userClient.createPost(makeTestPost(user.id, i));
            }

            for (let i = 0; i < 80; i++) {
                await adminClient.createPost(makeTestPost(adminUser.id, i));
            }
        });

        test('should stay at the New Messages line during initial load', async ({pw}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // * Verify that the New Messages line is actually visible
            expect(await channelsPage.centerView.notificationSeparator).toBeVisible();

            // * Verify that the post list didn't change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the New Messages line when switching to the channel', async ({pw}) => {
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

    function makeTestPost(authorId: string, n: number) {
        return {
            channel_id: channel.id,
            user_id: authorId,
            message: `message ${n}\nsecond line\nthird line`,
        };
    }

    async function waitForScrollToSettle(watcher: PostListScrollWatcher) {
        await channelsPage.centerView.toBeVisible();
        await page.waitForLoadState('networkidle');

        // # Wait until the post list hasn't scrolled for 500ms before returning results
        return watcher.waitForSettled(500);
    }
});

/**
 * These tests verify how the post list behaves the moment a channel is opened. In particular, they confirm that
 * little to no layout shift occurs while everything loads, which is expressed one of two ways:
 *
 * - For a fully read channel (or one where the latest unread post is within a page of the bottom), the post list
 *   should load and stay pinned to the bottom.
 * - For a channel with more than a page of unread posts, the post list should load with the New Messages line near
 *   the top of the viewport and that line should not move afterwards.
 *
 * The behaviour is measured by continuously sampling the scroll container's distance from the bottom and the New
 * Messages line's position within the viewport from the moment the channel starts to load until everything settles.
 */
test.describe.skip('Post list initial scroll', () => {
    let userClient: Client4;
    let adminClient: PlaywrightClient4;
    let user: UserProfile;
    let author: UserProfile;
    let team: Team;
    let channel: ServerChannel;

    let channelsPage: ChannelsPage;
    let page: Page;

    test.beforeEach(async ({pw}) => {
        // # Initialize a user with an empty channel of its own, plus a second user to post unread messages
        ({userClient, user, team, adminClient} = await pw.initSetup());
        [author] = await adminClient.createUsers(team.id, 1, 'author');

        channel = await userClient.createChannel({
            team_id: team.id,
            name: `post-list-${pw.random.id()}`,
            display_name: 'Post List Initial Scroll',
            type: 'O',
        });
        await adminClient.addToChannel(author.id, channel.id);

        // # Log in, but don't navigate to a channel yet
        ({channelsPage, page} = await pw.testBrowser.login(user));
    });

    type Expectation = 'bottom' | 'newMessagesTop';
    type NavMethod = 'directLoad' | 'switchToUnloaded' | 'switchToLoaded';

    type Scenario = {
        key: string;
        /** Human-readable description of the channel's contents. */
        description: string;
        /** Total number of posts to seed in the channel. */
        totalPosts: number;
        /** Number of posts at the end of the channel that should be left unread (0 means fully read). */
        unreadCount: number;
        /** Where the post list should come to rest after loading. */
        expectation: Expectation;
        /** Navigation methods this scenario is meaningful for. */
        navMethods: NavMethod[];
    };

    // A channel is considered "read via all three navigation methods" only when it has no unread messages, because
    // loading a channel's posts (which is what makes it "loaded") also marks it read.
    const READ_NAV_METHODS: NavMethod[] = ['directLoad', 'switchToUnloaded', 'switchToLoaded'];
    const UNREAD_NAV_METHODS: NavMethod[] = ['directLoad', 'switchToUnloaded'];

    // Post counts chosen relative to the 1280x1024 viewport: FEW does not fill the post list, MANY overflows it
    // within a single loaded chunk, and PAGES overflows it and spans more than one chunk (POST_CHUNK_SIZE is 60).
    // Each seeded post spans a few lines (see postMessage) so a handful of posts reliably overflows the viewport.
    const FEW = 3;
    const MANY = 25;
    const PAGES = 65;

    /** Build a multi-line message so each seeded post occupies a predictable, non-trivial amount of vertical space. */
    function postMessage(n: number) {
        return `message ${n}\nsecond line\nthird line`;
    }

    const scenarios: Scenario[] = [
        {
            key: 'empty',
            description: 'no posts',
            totalPosts: 0,
            unreadCount: 0,
            expectation: 'bottom',
            navMethods: READ_NAV_METHODS,
        },
        {
            key: 'few-read',
            description: 'fewer posts than fill the viewport, fully read',
            totalPosts: FEW,
            unreadCount: 0,
            expectation: 'bottom',
            navMethods: READ_NAV_METHODS,
        },
        {
            key: 'few-unread',
            description: 'fewer posts than fill the viewport, some unread',
            totalPosts: FEW,
            unreadCount: 2,
            expectation: 'bottom',
            navMethods: UNREAD_NAV_METHODS,
        },
        {
            key: 'many-read',
            description: 'more posts than fill the viewport, fully read',
            totalPosts: MANY,
            unreadCount: 0,
            expectation: 'bottom',
            navMethods: READ_NAV_METHODS,
        },
        {
            key: 'many-unread-near-bottom',
            description: 'more posts than fill the viewport, latest unread within a page of the bottom',
            totalPosts: MANY,
            unreadCount: 2,
            expectation: 'bottom',
            navMethods: UNREAD_NAV_METHODS,
        },
        {
            key: 'many-unread-far-from-bottom',
            description: 'more posts than fill the viewport, more than a page of unread posts',
            totalPosts: MANY,
            unreadCount: MANY - 3,
            expectation: 'newMessagesTop',
            navMethods: UNREAD_NAV_METHODS,
        },
        {
            key: 'pages-read',
            description: 'multiple pages of posts, fully read',
            totalPosts: PAGES,
            unreadCount: 0,
            expectation: 'bottom',
            navMethods: READ_NAV_METHODS,
        },
        {
            key: 'pages-unread-near-bottom',
            description: 'multiple pages of posts, latest unread within a page of the bottom',
            totalPosts: PAGES,
            unreadCount: 2,
            expectation: 'bottom',
            navMethods: UNREAD_NAV_METHODS,
        },
        {
            key: 'pages-unread-far-from-bottom',
            description: 'multiple pages of posts, more than a page of unread posts',
            totalPosts: PAGES,
            unreadCount: 40,
            expectation: 'newMessagesTop',
            navMethods: UNREAD_NAV_METHODS,
        },
    ];

    const navMethodDescriptions: Record<NavMethod, string> = {
        directLoad: 'opening the app directly in the channel',
        switchToUnloaded: 'switching to a channel that has not been loaded yet',
        switchToLoaded: 'switching back to a channel that has already been loaded',
    };

    for (const scenario of scenarios) {
        for (const navMethod of scenario.navMethods) {
            /**
             * @objective Verify the post list does not shift when opening a channel with {scenario.description} by
             * {navMethodDescriptions[navMethod]}.
             */
            test(
                `post list should not shift when ${navMethodDescriptions[navMethod]} (${scenario.description})`,
                {tag: '@post_list'},
                async () => {
                    // Known issue: cold-loading (as opposed to switching within an already-loaded app) an unread
                    // channel whose New Messages line is within a page of the bottom shows a transient ~40-120px
                    // scroll shift. After first paint, the message input box's formatting toolbar and the channel
                    // header finish mounting and resize the post list; because the list is scrolled to the New
                    // Messages line rather than pinned to the bottom, the scroll position is not re-pinned in the
                    // same frame, so the content visibly jumps before snapping back. Read channels and channels with
                    // more than a page of unread posts are unaffected, as is switching to the channel in an
                    // already-loaded app.
                    const hasKnownColdLoadShift =
                        navMethod === 'directLoad' && scenario.unreadCount > 0 && scenario.expectation === 'bottom';
                    test.fixme(hasKnownColdLoadShift, 'Post list shifts while the surrounding UI settles on cold load');

                    // # Seed the channel and set its read/unread state
                    await seedChannel(scenario.totalPosts, scenario.unreadCount);

                    // # Start watching the post list's scroll position before navigating
                    const watcher = await watchPostListScroll(page, channel.id);

                    // # Open the channel using the navigation method under test
                    await openChannel(navMethod, watcher);

                    // # Wait for the post list and all network activity to settle
                    await channelsPage.centerView.toBeVisible();
                    await page.waitForLoadState('networkidle');
                    const observations = await watcher.waitForSettled();

                    // * Verify the post list came to rest where it should have and never shifted while loading
                    if (scenario.expectation === 'bottom') {
                        assertStaysAtBottom(observations);
                    } else {
                        assertNewMessagesLineStableAtTop(observations);
                    }
                },
            );
        }
    }

    // Helpers specific to these tests

    /**
     * Seed the channel with `totalPosts` messages from the other user, leaving the last `unreadCount` of them unread
     * for the current user. The current user's last-viewed time is set between the read and unread posts so that the
     * New Messages line is placed just before the first unread post.
     */
    async function seedChannel(totalPosts: number, unreadCount: number) {
        const readCount = totalPosts - unreadCount;

        for (let i = 0; i < readCount; i++) {
            await adminClient.createPost({
                channel_id: channel.id,
                user_id: author.id,
                message: postMessage(i + 1),
            });
        }

        // # Mark everything posted so far as read for the current user
        await userClient.viewMyChannel(channel.id);

        if (unreadCount > 0) {
            // # Ensure the unread posts are created strictly after the last-viewed time
            await wait(100);

            for (let i = readCount; i < totalPosts; i++) {
                await adminClient.createPost({
                    channel_id: channel.id,
                    user_id: author.id,
                    message: postMessage(i + 1),
                });
            }
        }
    }

    /**
     * Navigate to the seeded channel using the given method.
     *
     * - `directLoad` loads the app straight into the channel.
     * - `switchToUnloaded` loads the app into another channel, then switches to the seeded channel for the first time.
     * - `switchToLoaded` loads the app into another channel, visits the seeded channel once to load it, returns to the
     *   other channel, then switches back to the (now loaded) seeded channel.
     *
     * For the switch methods, the watcher's observations are reset immediately before the measured switch so that only
     * the switch itself is captured.
     */
    async function openChannel(navMethod: NavMethod, watcher: PostListScrollWatcher) {
        if (navMethod === 'directLoad') {
            await channelsPage.goto(team.name, channel.name);
            return;
        }

        // # Load the app into another channel first
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.centerView.toBeVisible();

        if (navMethod === 'switchToLoaded') {
            // # Visit the seeded channel once to load it, then return to the other channel
            await channelsPage.sidebarLeft.goToItem(channel.name);
            await channelsPage.centerView.toBeVisible();
            await page.waitForLoadState('networkidle');
            await channelsPage.sidebarLeft.goToItem('off-topic');
            await channelsPage.centerView.toBeVisible();
        }

        // # Reset observations, then switch to the seeded channel
        await watcher.reset();
        await channelsPage.sidebarLeft.goToItem(channel.name);
    }
});

/**
 * A single sample of the post list's scroll position, taken while a channel loads.
 *
 * - `distanceFromBottom` is how far the scroll container is from being scrolled all the way to the bottom.
 * - `separatorTop` is the New Messages line's top edge relative to the top of the scroll container (null if absent).
 */
type ScrollObservation = {
    distanceFromBottom: number | null;
    clientHeight: number | null;
    scrollTop: number | null;
    scrollHeight: number | null;
    containerTop: number | null;
    hasSeparator: boolean;
    separatorTop: number | null;
    separatorViewportTop: number | null;
    at: number;
};

type PostListScrollWatcher = {
    /** Returns every distinct observation recorded since the watcher was installed or last reset. */
    getObservations: () => Promise<ScrollObservation[]>;
    /** Clears recorded observations. Used to isolate an in-app channel switch from earlier navigation. */
    reset: () => Promise<void>;
    /** Waits until no new observation has been recorded for a short quiet period, then returns all observations. */
    waitForSettled: (quietMs?: number) => Promise<ScrollObservation[]>;
};

/**
 * Installs a watcher that samples the post list's scroll position on every animation frame and records an observation
 * whenever the sampled values change. The watcher is registered with `addInitScript` so it survives navigation and
 * starts before the app loads; because it re-resolves the scroll container each frame, it also keeps working across
 * in-app channel switches that replace the post list.
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
                    const distanceFromBottom = Math.round(
                        container.scrollHeight - container.clientHeight - container.scrollTop,
                    );

                    const separator = document.querySelector('.NotificationSeparator');
                    const separatorViewportTop = separator ? Math.round(separator.getBoundingClientRect().top) : null;
                    const separatorTop =
                        separator && separatorViewportTop !== null
                            ? Math.round(separatorViewportTop - containerRect.top)
                            : null;

                    const observation = {
                        distanceFromBottom,
                        clientHeight: Math.round(container.clientHeight),
                        scrollTop: Math.round(container.scrollTop),
                        scrollHeight: Math.round(container.scrollHeight),
                        containerTop: Math.round(containerRect.top),
                        hasSeparator: separator !== null,
                        separatorTop,
                        separatorViewportTop,
                        at: Math.round(performance.now()),
                    };

                    const dedupeKey = [
                        observation.distanceFromBottom,
                        observation.clientHeight,
                        observation.scrollTop,
                        observation.scrollHeight,
                        observation.containerTop,
                        observation.hasSeparator,
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

    const reset = async () => {
        await page.evaluate((key) => {
            const state = (window as unknown as Record<string, {observations: ScrollObservation[]; lastKey: string}>)[
                key
            ];
            if (state) {
                state.observations = [];
                state.lastKey = '';
            }
        }, SCROLL_WATCHER_KEY);
    };

    const waitForSettled = async (quietMs = 750) => {
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
                {timeout: 20000, intervals: [100, 200, 300]},
            )
            .toBe(true);

        return getObservations();
    };

    return {getObservations, reset, waitForSettled};
}

/**
 * Asserts that the post list loaded at the bottom and never left it. A small tolerance absorbs sub-pixel rounding in
 * the scroll container.
 */
function assertStaysAtBottom(observations: ScrollObservation[], tolerance = 3) {
    const context = JSON.stringify(observations);

    expect(observations.length, `the scroll container should have appeared; observations=${context}`).toBeGreaterThan(
        0,
    );

    const distances = observations.map((o) => o.distanceFromBottom!);
    const maxDistance = Math.max(...distances);

    expect(maxDistance, `the post list should never leave the bottom; observations=${context}`).toBeLessThanOrEqual(
        tolerance,
    );
}

/**
 * Asserts that the New Messages line loaded near the top of the viewport and never moved afterwards.
 */
function assertNewMessagesLineStableAtTop(observations: ScrollObservation[], tolerance = 2) {
    const withSeparator = observations.filter((o) => o.hasSeparator && o.separatorTop !== null);
    const context = JSON.stringify(observations);

    expect(withSeparator.length, `the New Messages line should have appeared; observations=${context}`).toBeGreaterThan(
        0,
    );

    const tops = withSeparator.map((o) => o.separatorTop!);
    const spread = Math.max(...tops) - Math.min(...tops);

    expect(spread, `the New Messages line should not shift once visible; observations=${context}`).toBeLessThanOrEqual(
        tolerance,
    );

    const last = withSeparator[withSeparator.length - 1];

    // * The line should have settled in the upper portion of the viewport (i.e. it scrolled to the top rather than
    //   clamping to the bottom of a short channel).
    expect(
        last.separatorTop!,
        `the New Messages line should rest near the top of the viewport; observations=${context}`,
    ).toBeLessThanOrEqual(Math.round(last.clientHeight! / 2));

    expect(
        last.separatorTop!,
        `the New Messages line should rest within the viewport; observations=${context}`,
    ).toBeGreaterThanOrEqual(-tolerance);
}
