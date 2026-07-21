// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Disposable, Locator, Page} from '@playwright/test';

import {expect, getFileFromAsset, setupFileServer, test, watchElementSize} from '@mattermost/playwright-lib';
import type {ChannelsPage, ChannelsPost} from '@mattermost/playwright-lib';

test.describe('Post height', () => {
    let userClient: Client4;
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
        let adminClient: Client4;

        // # Initialize a user with an empty channel of its own
        ({userClient, user, team, adminClient} = await pw.initSetup());
        channel = await userClient.createChannel({
            team_id: team.id,
            name: `post-list-${pw.random.id()}`,
            display_name: 'Post List Layout Shift',
            type: 'O',
        });

        // # Enable SVG rendering and let the server fetch metadata from the local mock file server
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableSVGs: true,
                EnableLinkPreviews: true,
                AllowedUntrustedInternalConnections: 'localhost 127.0.0.1',
            },
        });

        // # Log in, but don't navigate to a channel yet
        ({channelsPage, page} = await pw.testBrowser.login(user));
    });

    type PostHeightTestCase = {
        name: string;
        /** Static seed options for posts that don't depend on the file server URL. */
        seedOptions?: SeedOptions;
        /** Seed options builder for posts that reference the file server (e.g. Markdown images). */
        getSeedOptions?: (baseUrl: string) => SeedOptions;
        /** Extra assertions to run once the post has loaded. */
        additionalCheck?: (args: {postComponent: ChannelsPost}) => Promise<void>;
        /** Playwright project names for which this test case should be skipped. */
        skipProjects?: string[];
    };

    const testCases: PostHeightTestCase[] = [
        {
            name: 'text only post',
            seedOptions: {
                message: 'text only post',
            },
        },
        {
            name: 'post with replies',
            seedOptions: {
                message: 'post with replies',
                replyCount: 3,
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the thread footer has rendered
                const image = postComponent.container.locator('.ThreadFooter');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with reactions',
            seedOptions: {
                message: 'post with reactions',
                reactions: ['thumbsup', 'heart', 'tada'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the reactions have rendered
                const image = postComponent.container.locator('.Reaction');
                await expect(image).toHaveCount(4);
            },
        },
        {
            name: 'post with a single image',
            seedOptions: {
                message: 'post with a single image',
                files: ['mattermost.png'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single small image',
            seedOptions: {
                message: 'post with a single small image',
                files: ['small-image.png'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.small-image__container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single large image',
            // TODO skip this on iPad because images that are too wide but above the minimum height cause layout shift
            skipProjects: ['ipad'],
            seedOptions: {
                message: 'post with a single large image',
                files: ['huge-image.jpg'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single wide image',
            seedOptions: {
                message: 'post with a single wide image',
                files: ['image-400x40.jpg'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.small-image__container img');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single tall image',
            seedOptions: {
                message: 'post with a single tall image',
                files: ['image-40x400.jpg'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.small-image__container img');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a non-image file attachment',
            seedOptions: {
                message: 'post with a non-image file attachment',
                files: ['sample_text_file.txt'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the attachment has rendered
                const image = postComponent.container.locator('.post-image__columns');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with multiple images',
            seedOptions: {
                message: 'post with multiple images',
                files: ['mattermost.png', 'mattermost-icon_128x128.png', 'mattermost.png'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the images have rendered
                const image = postComponent.container.locator('.MediaGallery__tile img');
                await expect(image).toHaveCount(3);
            },
        },
        {
            name: 'post with a code block without a language',
            seedOptions: {
                message: '```\nconst foo = 1;\nconst bar = 2;\n```',
            },
        },
        {
            name: 'post with a syntax-highlighted code block',
            seedOptions: {
                message: '```javascript\nconst foo = 1;\nconst bar = 2;\n```',
            },
        },
        {
            name: 'post with a message attachment',
            seedOptions: {
                message: 'post with a message attachment',
                props: {
                    attachments: [
                        {
                            author_name: 'Author',
                            title: 'Message attachment title',
                            title_link: 'https://example.com',
                            text: 'Message attachment body text',
                        },
                    ],
                },
            },
        },
        {
            name: 'post with a single SVG attachment',
            seedOptions: {
                message: 'post with a single SVG attachment',
                files: ['icon.svg'],
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the SVG has rendered as an image
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a Markdown image',
            getSeedOptions: (baseUrl) => ({
                message: `![mattermost](${baseUrl}/mattermost.png)`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a small Markdown image',
            getSeedOptions: (baseUrl) => ({
                message: `![small image](${baseUrl}/small-image.png)`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a large Markdown image',
            // TODO images that are too wide but above the minimum height cause layout shift
            skipProjects: ['chrome', 'firefox', 'ipad'],
            getSeedOptions: (baseUrl) => ({
                message: `![large image](${baseUrl}/huge-image.jpg)`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a wide Markdown image',
            getSeedOptions: (baseUrl) => ({
                message: `![wide image](${baseUrl}/image-400x40.jpg)`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a tall Markdown image',
            getSeedOptions: (baseUrl) => ({
                message: `![tall image](${baseUrl}/image-40x400.jpg)`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with an SVG Markdown image',
            // TODO Either Chrome preloads the SVG's dimensions early or Firefox doesn't allocate the height properly
            skipProjects: ['firefox'],
            getSeedOptions: (baseUrl) => ({
                message: `![icon](${baseUrl}/icon.svg)`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with an image preview',
            getSeedOptions: (baseUrl) => ({
                message: `${baseUrl}/mattermost.png`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a small image preview',
            getSeedOptions: (baseUrl) => ({
                message: `${baseUrl}/small-image.png`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a large image preview',
            // TODO images that are too wide but above the minimum height cause layout shift
            skipProjects: ['chrome', 'firefox', 'ipad'],
            getSeedOptions: (baseUrl) => ({
                message: `${baseUrl}/huge-image.jpg`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a wide image preview',
            getSeedOptions: (baseUrl) => ({
                message: `${baseUrl}/image-400x40.jpg`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a tall image preview',
            getSeedOptions: (baseUrl) => ({
                message: `${baseUrl}/image-40x400.jpg`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with an OpenGraph preview',
            getSeedOptions: (baseUrl) => ({
                message: `${baseUrl}/opengraph.html`,
            }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that an OpenGraph preview was rendered
                const preview = postComponent.container.locator('.PostAttachmentOpenGraph');
                await expect(preview).toBeVisible();
                await expect(preview.locator('.sitename')).toHaveText('Mattermost Test');
                await expect(preview.locator('.title')).toHaveText('OpenGraph Preview Title');
                await expect(preview.locator('.description')).toHaveText(
                    'This is a test page to generate an OpenGraph link preview.',
                );
                await expect(preview.locator('.PostAttachmentOpenGraph__image img')).toBeVisible();
            },
        },
    ];

    for (const testCase of testCases) {
        test(
            `post should keep a fixed height as it loads (${testCase.name})`,
            {tag: '@post_list'},
            async ({}, testInfo) => {
                test.skip(
                    testCase.skipProjects?.includes(testInfo.project.name) ?? false,
                    `Not supported on ${testInfo.project.name}`,
                );

                const seedOptions = testCase.getSeedOptions
                    ? testCase.getSeedOptions(fileServerUrl)
                    : testCase.seedOptions!;
                const post = await seedPost(seedOptions);

                const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

                // # Wait for any images to load
                await waitForImagesLoaded(postComponent.container);

                // # Wait for any additional checks to occur
                if (testCase.additionalCheck) {
                    await testCase.additionalCheck({postComponent});
                }

                // # Wait for all network requests to finish
                await page.waitForLoadState('networkidle');

                // * Verify no height changes were detected
                expect(await sizeWatcher.getObservations()).toHaveLength(1);
            },
        );
    }

    test("a post changes height when it's replied to for the first time", {tag: '@post_list'}, async () => {
        // # Create a post with no replies or attachments
        const post = await seedPost({
            message: 'post without a reply yet',
        });

        const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

        // * Verify no height changes were detected during initial rendering
        expect(await sizeWatcher.getObservations()).toHaveLength(1);

        // * Verify that the post has no replies
        await postComponent.toBeVisible();
        await expect(postComponent.threadFooter.container).not.toBeVisible();

        // # Reply to the post from another client
        await userClient.createPost({
            channel_id: post.channel_id,
            root_id: post.id,
            message: 'reply',
        });

        // * Verify that the post now has the the thread footer
        await postComponent.threadFooter.toBeVisible();
        await postComponent.threadFooter.toHaveNReplies(1);

        // * Verify that the post height changed size
        expect(await sizeWatcher.getObservations()).toHaveLength(2);

        // # Reply to the post again from another client
        await userClient.createPost({
            channel_id: post.channel_id,
            root_id: post.id,
            message: 'reply',
        });

        // * Verify that the thread footer has been updated
        await postComponent.threadFooter.toHaveNReplies(2);

        // * Verify that the post height changed size
        expect(await sizeWatcher.getObservations()).toHaveLength(2);
    });

    test("a post may change height when it's edited", {tag: '@post_list'}, async () => {
        // # Create a post with no replies or attachments
        const post = await seedPost({
            message: 'unedited post',
        });

        const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

        // * Verify no height changes were detected during initial rendering
        expect(await sizeWatcher.getObservations()).toHaveLength(1);

        // * Verify the initial post text
        await postComponent.toContainText('unedited post');

        // # Edit the post from another client
        await userClient.updatePost({
            ...post,
            message: 'edited post',
        });

        // * Verify that the post text has changed
        await postComponent.toContainText('edited post');

        // * Verify that the post height didn't change
        // TODO The post height shouldn't increase when it's edited, but it increases by 1px
        expect(await sizeWatcher.getObservations()).toHaveLength(2);

        // # Edit the post to be multiple linesfrom another client
        await userClient.updatePost({
            ...post,
            message: 'edited post\nwith multiple lines',
        });

        // * Verify that the post text has changed
        await postComponent.toContainText('edited post\nwith multiple lines');

        // * Verify that the post height didn't change
        expect(await sizeWatcher.getObservations()).toHaveLength(3);
    });

    // Helpers specific to these tests

    /**
     * Navigate to the seeded channel, wait for the target post to render, freeze animations so geometry is measured
     * at rest, and start watching for height changes
     */
    async function openChannelAndGetPost(postId: string) {
        // # Initialize element size watcher
        const sizeWatcher = await watchElementSize(page, `post_${postId}`);

        // # Disable animations and transitions
        await freezeAnimations(page);

        // # Navigate to the channel
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Get and return the post component
        const postComponent = await channelsPage.centerView.getPostById(postId);
        await postComponent.toBeVisible();

        // * Verify that the post element has been found by the height observer
        expect(await sizeWatcher.isWatchingElement()).toBe(true);

        return {sizeWatcher, postComponent};
    }

    let uploadCounter = 0;

    /** Upload an asset to a channel and return its file id. */
    async function uploadAsset(filename: string): Promise<string> {
        const formData = new FormData();
        // Order matters: channel_id, then client_ids, then files.
        formData.set('channel_id', channel.id);
        formData.set('client_ids', `pw-post-list-${uploadCounter++}`);
        formData.set('files', getFileFromAsset(filename), filename);

        const data = await userClient.uploadFile(formData);
        return data.file_infos[0].id;
    }

    type SeedOptions = {
        message: string;
        /** Asset filenames to upload and attach to the post. */
        files?: string[];
        /** Props to set on the post. */
        props?: Record<string, unknown>;
        /** Emoji names to react to the post with. */
        reactions?: string[];
        /** Number of replies to add under the post. */
        replyCount?: number;
    };

    /** Create a post (with optional attachments, reactions, replies) and return its root post. */
    async function seedPost(opts: SeedOptions) {
        const fileIds: string[] = [];
        for (const filename of opts.files ?? []) {
            fileIds.push(await uploadAsset(filename));
        }

        const root = await userClient.createPost({
            channel_id: channel.id,
            message: opts.message,
            file_ids: fileIds,
            props: opts.props,
        });

        for (const emoji of opts.reactions ?? []) {
            await userClient.addReaction(user.id, root.id, emoji);
        }

        for (let i = 0; i < (opts.replyCount ?? 0); i++) {
            await userClient.createPost({
                channel_id: channel.id,
                root_id: root.id,
                message: `reply ${i + 1}`,
            });
        }

        return root;
    }
});

/** Wait until every <img> within the locator has finished decoding. */
async function waitForImagesLoaded(locator: Locator): Promise<void> {
    await expect
        .poll(async () =>
            locator
                .locator('img')
                .evaluateAll(
                    (imgs) =>
                        (imgs as HTMLImageElement[]).filter((img) => !(img.complete && img.naturalWidth > 0)).length,
                ),
        )
        .toBe(0);
}

/**
 * Disable transitions/animations so we measure final geometry rather than a * frame captured mid-animation.
 */
async function freezeAnimations(page: Page): Promise<Disposable> {
    return page.addInitScript(() => {
        const style = document.createElement('style');
        style.textContent = `*, *::before, *::after {
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            scroll-behavior: auto !important;
        }`;
        document.documentElement.appendChild(style);
    });
}
