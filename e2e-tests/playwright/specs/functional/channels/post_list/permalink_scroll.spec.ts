// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Page} from '@playwright/test';
import type {Post} from '@mattermost/types/posts';

import {expect, setupFileServer, test} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightClient4} from '@mattermost/playwright-lib';

import {watchPostListScroll, type PostListScrollWatcher} from './initial_scroll.spec';

test.describe('Post list scroll to permalink', () => {
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

    test.describe('fully read channel with less than a screen of posts', () => {
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 2; i++) {
                await userClient.createPost(makeTestPost(i));
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 2; i < 4; i++) {
                await userClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the same place when clicking on an in-channel permalink for a visible post', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't move
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });
    });

    test.describe('fully read channel with a page of text posts', () => {
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 30; i++) {
                await userClient.createPost(makeTestPost(i));
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 30; i < 60; i++) {
                await userClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should move to the linked post when clicking on an in-channel permalink', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list scrolled up without jumping around
            expect(await waitForScrollToSettle(watcher)).toHaveLength(2);
        });
    });

    test.describe('fully read channel with multiple pages of text posts', () => {
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 60; i++) {
                await userClient.createPost(makeTestPost(i));
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 60; i < 120; i++) {
                await userClient.createPost(makeTestPost(i));
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should move to the linked post when clicking on an in-channel permalink', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list scrolled up without jumping around
            expect(await waitForScrollToSettle(watcher)).toHaveLength(2);
        });
    });

    test.describe('fully read channel with multiple pages of image attachments', () => {
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 60; i++) {
                await userClient.createTestPost(makeTestPost(i), ['mattermost.png']);
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 60; i < 120; i++) {
                await userClient.createTestPost(makeTestPost(i), ['mattermost.png']);
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should move to the linked post when clicking on an in-channel permalink', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list scrolled up without jumping around
            expect(await waitForScrollToSettle(watcher)).toHaveLength(2);
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
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 60; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `![test image](${fileServerUrl}/mattermost.png)`,
                });
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 60; i < 120; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `![test image](${fileServerUrl}/mattermost.png)`,
                });
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should move to the linked post when clicking on an in-channel permalink', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list scrolled up without jumping around
            expect(await waitForScrollToSettle(watcher)).toHaveLength(2);
        });
    });

    test.describe('fully read channel with multiple pages of link previews', () => {
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 60; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `${fileServerUrl}/opengraph.html`,
                });
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 60; i < 120; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `${fileServerUrl}/opengraph.html`,
                });
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should move to the linked post when clicking on an in-channel permalink', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list scrolled up without jumping around
            expect(await waitForScrollToSettle(watcher)).toHaveLength(2);
        });
    });

    test.describe('fully read channel with multiple pages of post previews', () => {
        let linkedPost: Post;
        let linkedPostUrl: string;

        test.beforeEach(async () => {
            // # Make a post to link to
            const firstPost = await userClient.createTestPost({
                channel_id: channel.id,
            });
            // # Make a lot of posts as the current user so that the channel stays read
            for (let i = 0; i < 60; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `${userClient.getUrl()}/${team.name}/pl/${firstPost.id}`,
                });
            }

            // # And make a post in the middle to link to
            linkedPost = await userClient.createPost({
                channel_id: channel.id,
                message: 'linked post',
            });
            linkedPostUrl = `${userClient.getUrl()}/${team.name}/pl/${linkedPost.id}`;

            for (let i = 60; i < 120; i++) {
                await userClient.createTestPost({
                    channel_id: channel.id,
                    message: `${userClient.getUrl()}/${team.name}/pl/${firstPost.id}`,
                });
            }
        });

        test('should stay at the linked post during initial load', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that post
            await page.goto(linkedPostUrl);

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should stay at the linked post when switching to the channel', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Start in Town Square and wait for its contents to load
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.centerView.getLastPost();

            // # Post a permalink pointing to the other channel
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Switch to the channel by clicking on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list didn't scroll or change height
            expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
        });

        test('should move to the linked post when clicking on an in-channel permalink', async ({}) => {
            const watcher = await watchPostListScroll(page, channel.id);

            // # Open the web app directly to that channel
            await channelsPage.goto(team.name, channel.name);

            // # Post a permalink pointing to that post
            await channelsPage.centerView.postMessage(linkedPostUrl);

            // # Clear the observer so that it doesn't include the shifts due to making a post
            await watcher.reset();

            // # Click on that link
            await page.locator(`a[href="${linkedPostUrl}"]`).click();

            // * Verify that the permalinked post is visible and highlighted
            const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
            await linkedPostComponent.toBeVisible();
            await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);

            // * Verify that the post list scrolled up without jumping around
            expect(await waitForScrollToSettle(watcher)).toHaveLength(2);
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
