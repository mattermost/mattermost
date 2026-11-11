// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Disposable, Locator, Page} from '@playwright/test';
import type {Post} from '@mattermost/types/posts';

import {expect, setupFileServer, test, testConfig, watchElementSize} from '@mattermost/playwright-lib';
import type {ChannelsPage, ChannelsPost, PlaywrightClient4} from '@mattermost/playwright-lib';

test.describe('Post height', () => {
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
        let adminClient: Client4;

        // # Initialize a user with an empty channel of its own
        ({userClient, user, team, adminClient} = await pw.initSetup());
        channel = await userClient.createChannel({
            team_id: team.id,
            name: `post-list-${pw.random.id()}`,
            display_name: 'Post List Layout Shift',
            type: 'O',
        });

        // # Enable SVG rendering and let the server fetch metadata from the mock file server.
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableSVGs: true,
                EnableLinkPreviews: true,
                AllowedUntrustedInternalConnections: new URL(fileServerUrl).hostname,
            },
        });

        // # Log in, but don't navigate to a channel yet
        ({channelsPage, page} = await pw.testBrowser.login(user));
    });

    type PostHeightTestCase = {
        name: string;
        /** Returns the post to be measured and does any other prep work needed to set up the post. */
        makePost: (options: {fileServerUrl: string; siteUrl: string}) => Promise<Post>;
        /** Extra assertions to run once the post has loaded. */
        additionalCheck?: (args: {postComponent: ChannelsPost}) => Promise<void>;
        /** Playwright project names for which this test case should be skipped. */
        skipProjects?: string[];
        /**
         * Allows the post height to change by less than half a pixel. An image file's preview can have a slightly
         * different aspect ratio than the original that its placeholder is sized from.
         */
        allowSubpixelHeightChange?: boolean;
    };

    const testCases: PostHeightTestCase[] = [
        {
            name: 'text only post',
            makePost: () =>
                seedPost({
                    message: 'text only post',
                }),
        },
        {
            name: 'post with replies',
            makePost: () =>
                seedPost({
                    message: 'post with replies',
                    replyCount: 3,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the thread footer has rendered
                const image = postComponent.container.locator('.ThreadFooter');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with reactions',
            makePost: () =>
                seedPost({
                    message: 'post with reactions',
                    reactions: ['thumbsup', 'heart', 'tada'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the reactions have rendered
                const image = postComponent.container.locator('.Reaction');
                await expect(image).toHaveCount(4);
            },
        },
        {
            name: 'post with a single image',
            makePost: () =>
                seedPost({
                    message: 'post with a single image',
                    files: ['mattermost.png'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single small image',
            makePost: () =>
                seedPost({
                    message: 'post with a single small image',
                    files: ['small-image.png'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.small-image__container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single large image',
            allowSubpixelHeightChange: true,
            makePost: () =>
                seedPost({
                    message: 'post with a single large image',
                    files: ['huge-image.jpg'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single wide image',
            makePost: () =>
                seedPost({
                    message: 'post with a single wide image',
                    files: ['image-400x40.jpg'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.small-image__container img');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a single tall image',
            makePost: () =>
                seedPost({
                    message: 'post with a single tall image',
                    files: ['image-40x400.jpg'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image has rendered
                const image = postComponent.container.locator('.small-image__container img');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a non-image file attachment',
            makePost: () =>
                seedPost({
                    message: 'post with a non-image file attachment',
                    files: ['sample_text_file.txt'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the attachment has rendered
                const image = postComponent.container.locator('.post-image__columns');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with multiple images',
            makePost: () =>
                seedPost({
                    message: 'post with multiple images',
                    files: ['mattermost.png', 'mattermost-icon_128x128.png', 'mattermost.png'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the images have rendered
                const image = postComponent.container.locator('.MediaGallery__tile img');
                await expect(image).toHaveCount(3);
            },
        },
        {
            name: 'post with a code block without a language',
            makePost: () =>
                seedPost({
                    message: '```\nconst foo = 1;\nconst bar = 2;\n```',
                }),
        },
        {
            name: 'post with a syntax-highlighted code block',
            makePost: () =>
                seedPost({
                    message: '```javascript\nconst foo = 1;\nconst bar = 2;\n```',
                }),
        },
        {
            name: 'post with a message attachment',
            // For some reason, the font size of the attachment title changes slightly on Firefox with MM Blocks
            // and concurrent React enabled at the same time.
            skipProjects: ['firefox'],
            makePost: () =>
                seedPost({
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
                }),
        },
        {
            name: 'post with a single SVG attachment',
            makePost: () =>
                seedPost({
                    message: 'post with a single SVG attachment',
                    files: ['icon.svg'],
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the SVG has rendered as an image
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a Markdown image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `![mattermost](${fileServerUrl}/mattermost.png)`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a small Markdown image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `![small image](${fileServerUrl}/small-image.png)`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a large Markdown image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `![large image](${fileServerUrl}/huge-image.jpg)`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a wide Markdown image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `![wide image](${fileServerUrl}/image-400x40.jpg)`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a tall Markdown image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `![tall image](${fileServerUrl}/image-40x400.jpg)`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with an SVG Markdown image',
            // As of MM-67372, the server no longer provides dimensions for external SVGs
            skipProjects: ['chrome', 'firefox', 'ipad', 'subpath'],
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `![icon](${fileServerUrl}/icon.svg)`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the Markdown image has rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with an image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/mattermost.png`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a small image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/small-image.png`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a large image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/huge-image.jpg`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a wide image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/image-400x40.jpg`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with a tall image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/image-40x400.jpg`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image is rendered
                const image = postComponent.container.locator('.image-loaded-container');
                await expect(image).toBeVisible();
            },
        },
        {
            name: 'post with an OpenGraph preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/opengraph.html`,
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
        {
            name: 'post with an OpenGraph preview with a larger image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/opengraph-huge.html`,
                }),
            additionalCheck: async ({postComponent}) => {
                const preview = postComponent.container.locator('.PostAttachmentOpenGraph');
                await expect(preview).toBeVisible();
                await expect(preview.locator('.sitename')).toHaveText('Mattermost Test');
                await expect(preview.locator('.title')).toHaveText('OpenGraph Preview Title');
                await expect(preview.locator('.description')).toHaveText('This is a test page with a large image.');
                await expect(preview.locator('.PostAttachmentOpenGraph__image img')).toBeVisible();
            },
        },
        {
            name: 'post with a post preview',
            makePost: async ({siteUrl}) => {
                const linkedPost = await seedPost({
                    message: 'This is a post to be previewed.',
                });

                return seedPost({
                    message: `${siteUrl}/${team.name}/pl/${linkedPost.id}`,
                });
            },
        },
        {
            name: 'post with a long post preview',
            makePost: async ({siteUrl}) => {
                const linkedPost = await seedPost({
                    message: new Array(50).fill('This is a multi-line post to be previewed.').join('\n'),
                });

                return seedPost({
                    message: `${siteUrl}/${team.name}/pl/${linkedPost.id}`,
                });
            },
            additionalCheck: async ({postComponent}) => {
                // * Verify that the preview is faded out and has the "Show more" link visible
                // Permalink previews need a second render pass once the linked post's content
                // arrives; extend past the default 10s to leave headroom under loaded CI.
                const showMoreButton = postComponent.container.locator('.post-preview-collapse__show-more-button');
                await expect(showMoreButton).toBeVisible({timeout: 20000});
                await expect(postComponent.container.locator('.post-message-preview--overflow')).toBeVisible();
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

                const post = await testCase.makePost({
                    fileServerUrl,
                    siteUrl: testConfig.siteURL,
                });

                const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

                // # Wait for any images to load
                await waitForImagesLoaded(postComponent.container);

                // # Wait for any additional checks to occur
                if (testCase.additionalCheck) {
                    await testCase.additionalCheck({postComponent});
                }

                // * Verify no height changes were detected
                const observations = await sizeWatcher.getObservations();
                if (testCase.allowSubpixelHeightChange) {
                    for (const {height} of observations) {
                        expect(height).toBeCloseTo(observations[0].height, 0);
                    }
                } else {
                    expect(observations).toHaveLength(1);
                }
            },
        );
    }

    // Images that are scaled down to fit the width of the post rather than being capped by the max image height
    const wideImageSurfaces = [
        {
            name: 'attachment',
            makePost: (file: string) => seedPost({message: `post with a ${file} attachment`, files: [file]}),
        },
        {
            name: 'Markdown image',
            makePost: (file: string) => seedPost({message: `![wide image](${fileServerUrl}/${file})`}),
        },
        {
            name: 'image preview',
            makePost: (file: string) => seedPost({message: `${fileServerUrl}/${file}`}),
        },
    ];

    for (const file of ['image-2000x400.jpg', 'image-1200x300.jpg']) {
        for (const messageDisplay of ['full', 'compact']) {
            for (const surface of wideImageSurfaces) {
                test(
                    `image placeholder should match the size of the loaded image (${file} ${surface.name}, ${messageDisplay} display)`,
                    {tag: '@post_list'},
                    async () => {
                        // # Set the message display setting and create the post
                        await userClient.savePreferences(user.id, [
                            {
                                user_id: user.id,
                                category: 'display_settings',
                                name: 'message_display',
                                value: messageDisplay,
                            },
                        ]);
                        const post = await surface.makePost(file);

                        // # Hold back the image so that its placeholder can be measured
                        let releaseImage = () => {};
                        const imageReleased = new Promise<void>((resolve) => {
                            releaseImage = resolve;
                        });
                        await page.route(
                            (url) =>
                                url.pathname.endsWith(`/${file}`) ||
                                /\/api\/v4\/files\/[^/]+\/preview$/.test(url.pathname),
                            async (route) => {
                                await imageReleased;
                                await route.continue();
                            },
                        );

                        const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

                        // * Verify that the post is shown with the chosen message display
                        if (messageDisplay === 'compact') {
                            await expect(postComponent.container).toHaveClass(/post--compact/);
                        } else {
                            await expect(postComponent.container).not.toHaveClass(/post--compact/);
                        }

                        // # Measure the placeholder and then let the image load
                        const placeholder = postComponent.container.locator('img.image-loading__placeholder');
                        await expect(placeholder).toBeAttached();
                        const placeholderBox = await placeholder.boundingBox();
                        releaseImage();

                        const image = postComponent.container.locator(
                            '.image-loaded-container img:not(.image-loading__placeholder)',
                        );
                        await expect(image).toBeVisible();
                        await waitForImagesLoaded(postComponent.container);

                        // * Verify that the image took the place of the placeholder without changing the post's height
                        expect(await image.boundingBox()).toEqual(placeholderBox);
                        expect(await sizeWatcher.getObservations()).toHaveLength(1);
                    },
                );
            }
        }
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
        expect(await sizeWatcher.getObservations()).toHaveLength(1);

        // # Edit the post to be multiple lines from another client
        await userClient.updatePost({
            ...post,
            message: 'edited post\nwith multiple lines',
        });

        // * Verify that the post text has changed
        await postComponent.toContainText('edited post\nwith multiple lines');

        // * Verify that the post height changed since it now takes up an extra line
        expect(await sizeWatcher.getObservations()).toHaveLength(2);
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
        const root = await userClient.createTestPost(
            {
                channel_id: channel.id,
                message: opts.message,
                props: opts.props,
            },
            opts.files,
        );

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

/**
 * Wait until every <img> within the locator has finished decoding, except for lazy-loaded ones which the browser
 * never loads while they're hidden (such as avatars in Compact display).
 */
async function waitForImagesLoaded(locator: Locator): Promise<void> {
    await expect
        .poll(async () =>
            locator
                .locator('img')
                .evaluateAll(
                    (imgs) =>
                        (imgs as HTMLImageElement[]).filter(
                            (img) =>
                                !(img.complete && img.naturalWidth > 0) &&
                                !(img.loading === 'lazy' && img.getClientRects().length === 0),
                        ).length,
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
