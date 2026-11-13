// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerChannel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {Page} from '@playwright/test';

import {expect, test, testConfig} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightClient4} from '@mattermost/playwright-lib';

const postsAround = 40;
const centerTolerancePx = 20;
const grownMessage = Array.from({length: 30}, (_, i) => `grown line ${i}`).join('\n');

test.describe('Post list keeps the permalinked post centered', () => {
    let userClient: PlaywrightClient4;
    let team: Team;
    let channel: ServerChannel;

    let channelsPage: ChannelsPage;
    let page: Page;

    let linkedPost: Post;
    let postAboveLinkedPost: Post;

    test.beforeEach(async ({pw}) => {
        let user;
        ({userClient, team, user} = await pw.initSetup());

        channel = await userClient.createChannel({
            team_id: team.id,
            name: `post-list-${pw.random.id()}`,
            display_name: 'Permalink center hold',
            type: 'O',
        });

        const olderPosts: Post[] = [];
        for (let i = 0; i < postsAround; i++) {
            olderPosts.push(await userClient.createPost(makeTestPost(`older ${i}`)));
        }
        postAboveLinkedPost = olderPosts[olderPosts.length - 2];

        linkedPost = await userClient.createPost(makeTestPost('linked post'));

        for (let i = 0; i < postsAround; i++) {
            await userClient.createPost(makeTestPost(`newer ${i}`));
        }

        ({channelsPage, page} = await pw.testBrowser.login(user));
    });

    /**
     * @objective Verify that the permalinked post stays centered when a post above it changes height after the
     * initial scroll.
     *
     * @precondition
     * A channel with enough posts above and below the linked post that the list has to scroll in both directions.
     */
    test('keeps the linked post centered when a post above it grows', {tag: '@post_list'}, async () => {
        // # Open the web app directly to the linked post
        await openPermalink();

        // * Verify that the linked post is centered once the list settles
        await expectLinkedPostCentered();

        // # Make a post above the linked post much taller from another client
        await growPostAboveLinkedPost();

        // * Verify that the linked post is centered again rather than pushed down by the taller post
        await expectLinkedPostCentered();
    });

    /**
     * @objective Verify that the list stops re-centering the permalinked post once the user scrolls.
     *
     * @precondition
     * A channel with enough posts above and below the linked post that the list has to scroll in both directions.
     */
    test('does not pull the user back to the linked post after they scroll', {tag: '@post_list'}, async () => {
        // # Open the web app directly to the linked post
        await openPermalink();

        // * Verify that the linked post is centered once the list settles
        await expectLinkedPostCentered();

        // # Scroll the post list up with the mouse wheel
        const container = scrollContainer();
        const box = await container.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        const scrollTopBeforeWheel = await getScrollTop();
        await page.mouse.wheel(0, -200);
        await expect.poll(getScrollTop).toBeLessThan(scrollTopBeforeWheel);
        const scrollTopAfterWheel = await waitForScrollTopToSettle();

        // # Make a post above the linked post much taller from another client
        await growPostAboveLinkedPost();

        // * Verify that the list was not scrolled back to re-center the linked post
        expect(await waitForScrollTopToSettle()).toBe(scrollTopAfterWheel);
    });

    // Helpers

    function makeTestPost(label: string) {
        return {
            channel_id: channel.id,
            message: `${label}\nsecond line\nthird line`,
        };
    }

    function scrollContainer() {
        return page.locator(`#postListContent[data-channel-id="${channel.id}"] #postListScrollContainer`);
    }

    async function openPermalink() {
        await page.goto(`${testConfig.baseURL}/${team.name}/pl/${linkedPost.id}`);

        const linkedPostComponent = await channelsPage.centerView.getPostById(linkedPost.id);
        await linkedPostComponent.toBeVisible();
        await expect(linkedPostComponent.container).toHaveClass(/\bpost--highlight\b/);
    }

    async function growPostAboveLinkedPost() {
        await userClient.updatePost({...postAboveLinkedPost, message: grownMessage});
        await channelsPage.centerView.waitUntilPostWithIdContains(postAboveLinkedPost.id, 'grown line 29');
    }

    async function getLinkedPostOffsetFromCenter() {
        const containerBox = await scrollContainer().boundingBox();
        const postBox = await channelsPage.centerView.postById(linkedPost.id).boundingBox();
        if (!containerBox || !postBox) {
            return Number.POSITIVE_INFINITY;
        }

        return Math.abs(postBox.y + postBox.height / 2 - (containerBox.y + containerBox.height / 2));
    }

    async function expectLinkedPostCentered() {
        expect(await waitToSettle(getLinkedPostOffsetFromCenter)).toBeLessThanOrEqual(centerTolerancePx);
    }

    async function getScrollTop() {
        return scrollContainer().evaluate((element) => element.scrollTop);
    }

    async function waitForScrollTopToSettle() {
        return waitToSettle(getScrollTop);
    }

    // Returns the value once it has stopped changing for long enough that the list has processed any new row
    // measurements and applied any pending (debounced) re-center.
    async function waitToSettle(read: () => Promise<number>) {
        let previous = await read();
        let stableSince = Date.now();

        await expect
            .poll(
                async () => {
                    const current = await read();
                    if (current !== previous) {
                        previous = current;
                        stableSince = Date.now();
                    }
                    return Date.now() - stableSince;
                },
                {intervals: [100]},
            )
            .toBeGreaterThanOrEqual(1000);

        return previous;
    }
});
