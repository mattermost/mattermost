// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Disposable, Locator, Page} from '@playwright/test';
import type {Post} from '@mattermost/types/posts';

import {expect, setupFileServer, test, testConfig, watchElementSize, duration} from '@mattermost/playwright-lib';
import type {App, PlaywrightClient4, SizeWatcher} from '@mattermost/playwright-lib';

type CenterPost = ReturnType<App['center']['postList']['post']>;
type ThreadPost = ReturnType<App['rhs']['thread']['post']>;
type SurfaceImage =
    | CenterPost['markdown']['image']
    | CenterPost['imagePreview']
    | ReturnType<CenterPost['attachments']['image']>['picture'];

test.describe('Post height', () => {
    let userClient: PlaywrightClient4;
    let user: UserProfile;
    let team: Team;
    let channel: ServerChannel;

    let app: App;
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
        ({app, page} = await pw.testBrowser.login(user));
    });

    type PostHeightTestCase = {
        name: string;
        /** Returns the post to be measured and does any other prep work needed to set up the post. */
        makePost: (options: {fileServerUrl: string; siteUrl: string}) => Promise<Post>;
        /** Extra assertions to run once the post has loaded. */
        additionalCheck?: (args: {post: Post; postComponent: CenterPost}) => Promise<void>;
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
                await expect(postComponent.threadFooter.replyButton).toBeVisible();
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
                await expect(postComponent.reactions.reactionList).toHaveKeyCount(3);
            },
        },
        {
            name: 'post with a single image',
            makePost: () =>
                seedPost({
                    message: 'post with a single image',
                    files: ['mattermost.png'],
                }),
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the image has rendered
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.frame).toHaveClass(
                    /\bimage-loaded-container\b/,
                );
            },
        },
        {
            name: 'post with a single small image',
            makePost: () =>
                seedPost({
                    message: 'post with a single small image',
                    files: ['small-image.png'],
                }),
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the image has rendered
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.frame).toHaveClass(
                    /\bsmall-image__container\b/,
                );
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
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the image has rendered
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.frame).toHaveClass(
                    /\bimage-loaded-container\b/,
                );
            },
        },
        {
            name: 'post with a single wide image',
            makePost: () =>
                seedPost({
                    message: 'post with a single wide image',
                    files: ['image-400x40.jpg'],
                }),
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the image has rendered
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.frame).toHaveClass(
                    /\bsmall-image__container\b/,
                );
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.container).toBeVisible();
            },
        },
        {
            name: 'post with a single tall image',
            makePost: () =>
                seedPost({
                    message: 'post with a single tall image',
                    files: ['image-40x400.jpg'],
                }),
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the image has rendered
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.frame).toHaveClass(
                    /\bsmall-image__container\b/,
                );
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.container).toBeVisible();
            },
        },
        {
            name: 'post with a non-image file attachment',
            makePost: () =>
                seedPost({
                    message: 'post with a non-image file attachment',
                    files: ['sample_text_file.txt'],
                }),
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the attachment has rendered
                await expect(postComponent.attachments.fileCard({id: fileIdOf(post)})).toBeVisible();
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
                await expect(postComponent.attachments.fileList).toHaveKeyCount(3);
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
            additionalCheck: async ({post, postComponent}) => {
                // * Verify that the SVG has rendered as an image
                await expect(postComponent.attachments.image({id: fileIdOf(post)}).picture.frame).toHaveClass(
                    /\bimage-loaded-container\b/,
                );
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
                await expect(postComponent.markdown.image.frame).toHaveClass(/\bimage-loaded-container\b/);
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
                await expect(postComponent.markdown.image.frame).toHaveClass(/\bimage-loaded-container\b/);
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
                await expect(postComponent.markdown.image.frame).toHaveClass(/\bimage-loaded-container\b/);
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
                await expect(postComponent.markdown.image.frame).toHaveClass(/\bimage-loaded-container\b/);
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
                await expect(postComponent.markdown.image.frame).toHaveClass(/\bimage-loaded-container\b/);
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
                await expect(postComponent.markdown.image.frame).toHaveClass(/\bimage-loaded-container\b/);
            },
        },
        {
            name: 'post with an image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/mattermost.png`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image preview has rendered
                await expect(postComponent.imagePreview.frame).toHaveClass(/\bimage-loaded-container\b/);
            },
        },
        {
            name: 'post with a small image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/small-image.png`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image preview has rendered
                await expect(postComponent.imagePreview.frame).toHaveClass(/\bimage-loaded-container\b/);
            },
        },
        {
            name: 'post with a large image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/huge-image.jpg`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image preview has rendered
                await expect(postComponent.imagePreview.frame).toHaveClass(/\bimage-loaded-container\b/);
            },
        },
        {
            name: 'post with a wide image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/image-400x40.jpg`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image preview has rendered
                await expect(postComponent.imagePreview.frame).toHaveClass(/\bimage-loaded-container\b/);
            },
        },
        {
            name: 'post with a tall image preview',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/image-40x400.jpg`,
                }),
            additionalCheck: async ({postComponent}) => {
                // * Verify that the image preview has rendered
                await expect(postComponent.imagePreview.frame).toHaveClass(/\bimage-loaded-container\b/);
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
                const preview = postComponent.linkPreview;
                await expect(postComponent.linkPreview.container).toBeVisible();
                await expect(preview.siteNameText).toHaveText('Mattermost Test');
                await expect(preview.titleText).toHaveText('OpenGraph Preview Title');
                await expect(preview.descriptionText).toHaveText(
                    'This is a test page to generate an OpenGraph link preview.',
                );
                await expect(preview.image.container).toBeVisible();
            },
        },
        {
            name: 'post with an OpenGraph preview with a larger image',
            makePost: ({fileServerUrl}) =>
                seedPost({
                    message: `${fileServerUrl}/opengraph-huge.html`,
                }),
            additionalCheck: async ({postComponent}) => {
                const preview = postComponent.linkPreview;
                await expect(postComponent.linkPreview.container).toBeVisible();
                await expect(preview.siteNameText).toHaveText('Mattermost Test');
                await expect(preview.titleText).toHaveText('OpenGraph Preview Title');
                await expect(preview.descriptionText).toHaveText('This is a test page with a large image.');
                await expect(preview.image.container).toBeVisible();
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
                // (the preview's Show more only renders when its message overflows)
                const showMoreButton = postComponent.permalinkPreview.message.showMoreButton;
                await expect(showMoreButton).toBeVisible({timeout: duration.half_min});
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
                await waitForImagesLoaded(postComponent.locator);

                // # Wait for any additional checks to occur
                if (testCase.additionalCheck) {
                    await testCase.additionalCheck({post, postComponent});
                }

                // * Verify no height changes were detected
                const observations = await sizeWatcher.getObservations();
                if (testCase.allowSubpixelHeightChange) {
                    expect(observations.length).toBeGreaterThan(0);
                    for (const {height} of observations) {
                        expect(height).toBeCloseTo(observations[0].height, 0);
                    }
                } else {
                    expect(observations).toHaveLength(1);
                }
            },
        );
    }

    // Images that are scaled down to fit the width of the post rather than being capped by the max image height. The
    // server's previews of these images keep their exact aspect ratio, so their placeholders can match exactly.
    const attachmentImageOf = (postComponent: CenterPost, post: Post) =>
        postComponent.attachments.image({id: fileIdOf(post)}).picture;
    const markdownImageOf = (postComponent: CenterPost) => postComponent.markdown.image;
    const imagePreviewOf = (postComponent: CenterPost) => postComponent.imagePreview;

    const wideImageSurfaces: Array<{
        name: string;
        files?: string[];
        makePost: (file: string) => Promise<Post>;
        imageOf: (postComponent: CenterPost, post: Post) => SurfaceImage;
    }> = [
        {
            name: 'attachment',
            makePost: (file: string) => seedPost({message: `post with a ${file} attachment`, files: [file]}),
            imageOf: attachmentImageOf,
        },
        {
            name: 'Markdown image',
            makePost: (file: string) => seedPost({message: `![wide image](${fileServerUrl}/${file})`}),
            imageOf: markdownImageOf,
        },
        {
            name: 'Markdown image with an explicit size',
            makePost: (file: string) => seedPost({message: `![wide image](${fileServerUrl}/${file} =200x50)`}),
            imageOf: markdownImageOf,
        },
        {
            name: 'Markdown image with an explicit width',
            makePost: (file: string) => seedPost({message: `![wide image](${fileServerUrl}/${file} =300)`}),
            imageOf: markdownImageOf,
        },
        {
            name: 'image preview',
            makePost: (file: string) => seedPost({message: `${fileServerUrl}/${file}`}),
            imageOf: imagePreviewOf,
        },
        {
            // An image shorter than its line, where its vertical alignment affects the height of the line
            name: 'Markdown image between words',
            files: ['image-100x20.jpg'],
            makePost: (file: string) =>
                seedPost({message: `text before ![inline image](${fileServerUrl}/${file}) text after`}),
            imageOf: markdownImageOf,
        },
    ];

    for (const surface of wideImageSurfaces) {
        for (const file of surface.files ?? ['image-2000x400.jpg', 'image-1200x300.jpg']) {
            for (const messageDisplay of ['full', 'compact']) {
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
                            await expect(postComponent.locator).toHaveClass(/post--compact/);
                        } else {
                            await expect(postComponent.locator).not.toHaveClass(/post--compact/);
                        }

                        // # Measure the placeholder and then let the image load
                        const surfaceImage = surface.imageOf(postComponent, post);
                        await expect(surfaceImage.placeholder).toBeAttached();
                        const placeholderBox = await surfaceImage.placeholder.locator.boundingBox();
                        releaseImage();

                        await expect(surfaceImage.container).toBeVisible();
                        await waitForImagesLoaded(postComponent.locator);

                        // * Verify that the image has the placeholder's position and size and the post's height didn't change
                        expect(await surfaceImage.container.locator.boundingBox()).toEqual(placeholderBox);
                        expect(await sizeWatcher.getObservations()).toHaveLength(1);
                    },
                );
            }
        }
    }

    // Small images are wrapped in a bordered container, and the image itself shouldn't add its own border
    for (const file of ['small-image.png', 'image-400x40.jpg']) {
        test(
            `image placeholder should match the size of the loaded image (${file} small attachment)`,
            {tag: '@post_list'},
            async () => {
                const post = await seedPost({message: `post with a ${file} attachment`, files: [file]});

                // # Hold back the image so that its placeholder can be measured
                let releaseImage = () => {};
                const imageReleased = new Promise<void>((resolve) => {
                    releaseImage = resolve;
                });
                await page.route(
                    (url) => /\/api\/v4\/files\/[^/]+(\/preview)?$/.test(url.pathname),
                    async (route) => {
                        await imageReleased;
                        await route.continue();
                    },
                );

                const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

                // # Measure the placeholder and then let the image load
                const picture = attachmentImageOf(postComponent, post);
                await expect(picture.placeholder).toBeAttached();
                const placeholderBox = await boundingBoxOf(picture.placeholder.locator);
                releaseImage();

                await expect(picture.container).toBeVisible();
                await waitForImagesLoaded(postComponent.locator);

                // * Verify that the image has the size of the placeholder and the post's height didn't change
                const imageBox = await boundingBoxOf(picture.container.locator);
                expect(imageBox.width).toBeCloseTo(placeholderBox.width, 0);
                expect(imageBox.height).toBeCloseTo(placeholderBox.height, 0);
                expect(await sizeWatcher.getObservations()).toHaveLength(1);
            },
        );
    }

    for (const messageDisplay of ['full', 'compact']) {
        test(
            `OpenGraph thumbnail placeholder should match the size of the loaded image (image-600x1200.jpg, ${messageDisplay} display)`,
            {tag: '@post_list'},
            async () => {
                // # Set the message display setting and create a post with a link preview that has a tall thumbnail
                await userClient.savePreferences(user.id, [
                    {
                        user_id: user.id,
                        category: 'display_settings',
                        name: 'message_display',
                        value: messageDisplay,
                    },
                ]);
                const post = await seedPost({message: `${fileServerUrl}/opengraph-tall.html`});

                // # Hold back the image so that its placeholder can be measured
                let releaseImage = () => {};
                const imageReleased = new Promise<void>((resolve) => {
                    releaseImage = resolve;
                });
                await page.route(
                    (url) => url.pathname.endsWith('/image-600x1200.jpg') || url.pathname === '/api/v4/image',
                    async (route) => {
                        await imageReleased;
                        await route.continue();
                    },
                );

                const {sizeWatcher, postComponent} = await openChannelAndGetPost(post.id);

                // * Verify that the link preview has a thumbnail rather than a large image
                const preview = postComponent.linkPreview;
                const thumbnail = preview.imageBox;
                await expect(thumbnail).toBeVisible();
                await expect(thumbnail).not.toHaveClass(/large/);

                // # Measure the placeholder and then let the image load
                await expect(preview.image.placeholder).toBeAttached();
                const placeholderBox = await boundingBoxOf(preview.image.placeholder.locator);
                releaseImage();

                await expect(preview.image.container).toBeVisible();
                await waitForImagesLoaded(postComponent.locator);

                // * Verify that the image has the size of the placeholder and fits within the thumbnail
                const imageBox = await boundingBoxOf(preview.image.container.locator);
                expect({width: imageBox.width, height: imageBox.height}).toEqual({
                    width: placeholderBox.width,
                    height: placeholderBox.height,
                });

                const thumbnailBox = await boundingBoxOf(thumbnail.locator);
                expect(imageBox.x).toBeGreaterThanOrEqual(thumbnailBox.x);
                expect(imageBox.y).toBeGreaterThanOrEqual(thumbnailBox.y);
                expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(thumbnailBox.x + thumbnailBox.width);
                expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(thumbnailBox.y + thumbnailBox.height);

                // * Verify that the post's height didn't change
                expect(await sizeWatcher.getObservations()).toHaveLength(1);
            },
        );
    }

    // Message attachment images are rendered by MM Blocks, which caps their size with inline max widths and heights
    // (320x184 for the image and 204x120 for the thumbnail) rather than with the post's CSS
    const attachmentImages = [
        {file: 'image-2000x400.jpg', field: 'image_url'},
        {file: 'image-40x400.jpg', field: 'image_url'},
        {file: 'image-2000x400.jpg', field: 'thumb_url'},
        {file: 'image-40x400.jpg', field: 'thumb_url'},
    ];
    const attachmentSurfaces = [
        {name: 'full display', messageDisplay: 'full'},
        {name: 'compact display', messageDisplay: 'compact'},
        {name: 'narrow window', messageDisplay: 'full', viewport: {width: 390, height: 844}},
        {name: 'thread', messageDisplay: 'full', inThread: true},
    ];

    for (const {file, field} of attachmentImages) {
        for (const surface of attachmentSurfaces) {
            test(
                `attachment image placeholder should match the size of the loaded image (${file} ${field}, ${surface.name})`,
                {tag: '@post_list'},
                async () => {
                    // # Set the message display setting and the window size, and create the post
                    await userClient.savePreferences(user.id, [
                        {
                            user_id: user.id,
                            category: 'display_settings',
                            name: 'message_display',
                            value: surface.messageDisplay,
                        },
                    ]);
                    if (surface.viewport) {
                        await page.setViewportSize(surface.viewport);
                    }
                    const post = await seedPost({
                        message: `post with a ${file} attachment ${field}`,
                        props: {
                            attachments: [{title: 'Attachment title', [field]: `${fileServerUrl}/${file}`}],
                        },
                    });

                    // # Hold back the image so that its placeholder can be measured
                    const releaseImage = await holdBackImage(file);

                    let sizeWatcher: SizeWatcher;
                    let postComponent: CenterPost | ThreadPost;
                    if (surface.inThread) {
                        // # Open the post's thread and watch its root post instead
                        const rhsSizeWatcher = await watchElementSize(page, `rhsPost_${post.id}`);
                        const {postComponent: centerPost} = await openChannelAndGetPost(post.id);
                        await centerPost.locator.hover();
                        await centerPost.menu.replyButton.clickTo(app.rhs.postCreate);
                        postComponent = app.rhs.thread.post({id: post.id});
                        await expect(postComponent).toBeVisible();
                        sizeWatcher = rhsSizeWatcher;
                    } else {
                        ({sizeWatcher, postComponent} = await openChannelAndGetPost(post.id));
                    }

                    // # Measure the placeholder and then let the image load
                    const {blockImage} = postComponent;
                    await expect(blockImage.placeholder).toBeVisible();
                    const placeholderBox = await boundingBoxOf(blockImage.placeholder.locator);

                    // * Verify that the loading spinner is centered within the image's frame, which hides any overflow.
                    // It's wider than the tall thumbnail, so it can't always fit entirely.
                    const frameBox = await boundingBoxOf(postComponent.blockImageFrame.locator);
                    const spinnerBox = await boundingBoxOf(blockImage.loading.locator);
                    expect(spinnerBox.x + spinnerBox.width / 2).toBeCloseTo(frameBox.x + frameBox.width / 2, 0);
                    expect(spinnerBox.y + spinnerBox.height / 2).toBeCloseTo(frameBox.y + frameBox.height / 2, 0);

                    releaseImage();

                    await expect(blockImage.container).toBeVisible();
                    await waitForImagesLoaded(postComponent.locator);

                    // * Verify that the image has the size of the placeholder and the post's height didn't change
                    const imageBox = await boundingBoxOf(blockImage.container.locator);
                    expect(imageBox.width).toBeCloseTo(placeholderBox.width, 0);
                    expect(imageBox.height).toBeCloseTo(placeholderBox.height, 0);
                    const observations = await sizeWatcher.getObservations();
                    expect(observations.length).toBeGreaterThan(0);
                    for (const {height} of observations) {
                        expect(height).toBeCloseTo(observations[0].height, 0);
                    }
                },
            );
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
        await expect(postComponent).toBeVisible();
        await expect(postComponent.threadFooter.replyButton).not.toBeVisible();

        // # Reply to the post from another client
        await userClient.createPost({
            channel_id: post.channel_id,
            root_id: post.id,
            message: 'reply',
        });

        // * Verify that the post now has the the thread footer
        await expect(postComponent.threadFooter.replyButton).toContainText('1 reply');

        // * Verify that the post height changed size
        expect(await sizeWatcher.getObservations()).toHaveLength(2);

        // # Reply to the post again from another client
        await userClient.createPost({
            channel_id: post.channel_id,
            root_id: post.id,
            message: 'reply',
        });

        // * Verify that the thread footer has been updated
        await expect(postComponent.threadFooter.replyButton).toContainText('2 replies');

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
        await expect(postComponent).toContainText('unedited post');

        // # Edit the post from another client
        await userClient.updatePost({
            ...post,
            message: 'edited post',
        });

        // * Verify that the post text has changed
        await expect(postComponent).toContainText('edited post');

        // * Verify that the post height didn't change
        expect(await sizeWatcher.getObservations()).toHaveLength(1);

        // # Edit the post to be multiple lines from another client
        await userClient.updatePost({
            ...post,
            message: 'edited post\nwith multiple lines',
        });

        // * Verify that the post text has changed
        await expect(postComponent).toContainText('edited post\nwith multiple lines');

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
        await app.channelsPage.goto({team, channel});
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Get and return the post component
        const postComponent = app.center.postList.post({id: postId});
        await expect(postComponent).toBeVisible();

        // * Verify that the post element has been found by the height observer
        expect(await sizeWatcher.isWatchingElement()).toBe(true);

        return {sizeWatcher, postComponent};
    }

    /** Delay responses for an image from the file server until the returned function is called */
    async function holdBackImage(file: string) {
        let releaseImage = () => {};
        const imageReleased = new Promise<void>((resolve) => {
            releaseImage = resolve;
        });
        await page.route(
            (url) => url.pathname.endsWith(`/${file}`),
            async (route) => {
                await imageReleased;
                await route.continue();
            },
        );

        return releaseImage;
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
                // eslint-disable-next-line test-surface/e2e-no-literal-locators -- checks every image in the post, including ones with no test id (emoji, avatars)
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

/** The id of the file attached to a post (the first one unless an index is given). */
function fileIdOf(post: Post, index = 0): string {
    const id = post.file_ids?.[index];
    if (!id) {
        throw new Error(`Expected post ${post.id} to have a file at index ${index}`);
    }
    return id;
}

/** An element's bounding box, which exists only while it is rendered and visible. */
async function boundingBoxOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error(`Expected ${locator} to have a bounding box`);
    }
    return box;
}
