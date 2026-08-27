// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Page} from '@playwright/test';

import {expect, setupFileServer, test, testConfig} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightClient4} from '@mattermost/playwright-lib';

import {watchPostListScroll, type PostListScrollWatcher} from './scroll_helpers';

test.describe('Post list initial scroll in unread channel', () => {
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

    // These tests create an unread channel by having the current user create some posts and then another user
    // creates more.
    const testCases = [
        {
            name: 'less than a screen of posts',
            setupPosts: async () => {
                // # Make a post as the current user first so that the New Messages line shows up
                await userClient.createPost(makeTestPost(0));

                for (let i = 0; i < 3; i++) {
                    await adminClient.createPost(makeTestPost(i));
                }
            },
        },
        {
            name: 'with a page of text posts',
            setupPosts: async () => {
                for (let i = 0; i < 20; i++) {
                    await userClient.createPost(makeTestPost(i));
                }

                for (let i = 0; i < 20; i++) {
                    await adminClient.createPost(makeTestPost(i));
                }
            },
        },
        {
            name: 'with multiple pages of text posts',
            setupPosts: async () => {
                for (let i = 0; i < 80; i++) {
                    await userClient.createPost(makeTestPost(i));
                }

                for (let i = 0; i < 80; i++) {
                    await adminClient.createPost(makeTestPost(i));
                }
            },
        },
        {
            name: 'with multiple pages of long text posts',
            setupPosts: async () => {
                for (let i = 0; i < 80; i++) {
                    await userClient.createPost({
                        channel_id: channel.id,
                        message: new Array(100).fill(`this is a long post ${i}`).join('\n'),
                    });
                }

                for (let i = 0; i < 80; i++) {
                    await adminClient.createPost({
                        channel_id: channel.id,
                        message: new Array(100).fill(`this is a long post ${i}`).join('\n'),
                    });
                }
            },
        },
        {
            name: 'with multiple pages of image attachments',
            setupPosts: async () => {
                for (let i = 0; i < 80; i++) {
                    await userClient.createTestPost(makeTestPost(i), ['mattermost.png']);
                }

                for (let i = 0; i < 80; i++) {
                    await adminClient.createTestPost(makeTestPost(i), ['mattermost.png']);
                }
            },
        },
        {
            name: 'with multiple pages of markdown images',
            setupPosts: async () => {
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
            },
        },
        {
            name: 'with multiple pages of link previews',
            setupPosts: async () => {
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
            },
        },
        {
            name: 'with multiple pages of post previews',
            setupPosts: async () => {
                const linkedPost = await userClient.createTestPost({
                    channel_id: channel.id,
                });

                for (let i = 0; i < 80; i++) {
                    await userClient.createTestPost({
                        channel_id: channel.id,
                        message: `${testConfig.internalBaseURL}/${team.name}/pl/${linkedPost.id}`,
                    });
                }

                for (let i = 0; i < 80; i++) {
                    await adminClient.createTestPost({
                        channel_id: channel.id,
                        message: `${testConfig.internalBaseURL}/${team.name}/pl/${linkedPost.id}`,
                    });
                }
            },
        },
    ];

    for (const testCase of testCases) {
        test.describe(testCase.name, () => {
            test.beforeEach(testCase.setupPosts);

            test(`${testCase.name} - should stay at the bottom during initial load`, async ({}) => {
                const watcher = await watchPostListScroll(page, channel.id);

                // # Open the web app directly to that channel
                await channelsPage.goto(team.name, channel.name);

                // * Verify that the New Messages line is actually visible
                await expect(channelsPage.centerView.notificationSeparator).toBeVisible();

                expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
            });

            test(`${testCase.name} - should stay at the bottom when switching to the channel`, async ({}) => {
                const watcher = await watchPostListScroll(page, channel.id);

                // # Start in Town Square and wait for its contents to load
                await channelsPage.goto(team.name, 'town-square');
                await channelsPage.centerView.getLastPost();

                // * Verify that the channel starts as unread
                await channelsPage.sidebarLeft.assertItemUnread(channel.name);

                // # Switch to the channel
                await channelsPage.sidebarLeft.goToItem(channel.name);

                // * Verify that the New Messages line is still visible
                await expect(channelsPage.centerView.notificationSeparator).toBeVisible();

                // * Verify that the post list didn't scroll or change height
                expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
            });
        });
    }

    function makeTestPost(n: number) {
        return {
            channel_id: channel.id,
            message: `message ${n}\nsecond line\nthird line`,
        };
    }

    async function waitForScrollToSettle(watcher: PostListScrollWatcher) {
        await channelsPage.centerView.toBeVisible();

        // # Wait until the post list hasn't scrolled for 500ms before returning results
        return watcher.waitForObservations(500);
    }
});
