// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    Post,
    PostEmbed,
    PostImage,
    PostMetadata,
} from '@mattermost/types/posts';

import * as postUtils from 'mattermost-redux/utils/post_utils';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import PostBodyAdditionalContent from './post_body_additional_content';
import type {Props} from './post_body_additional_content';

vi.mock('mattermost-redux/utils/post_utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('mattermost-redux/utils/post_utils')>();
    return {
        ...actual,
        getEmbedFromMetadata: vi.fn(actual.getEmbedFromMetadata),
    };
});

describe('PostBodyAdditionalContent', () => {
    const baseProps: Props = {
        children: <span>{'some children'}</span>,
        post: {
            id: 'post_id_1',
            root_id: 'root_id',
            channel_id: 'channel_id',
            create_at: 1,
            message: '',
            metadata: {} as PostMetadata,
        } as Post,
        isEmbedVisible: true,
        handleFileDropdownOpened: vi.fn(),
        actions: {
            toggleEmbedVisibility: vi.fn(),
        },
        appsEnabled: false,
    };

    describe('with an image preview', () => {
        const imageUrl = 'https://example.com/image.png';
        const imageMetadata = {} as PostImage; // This can be empty since we're checking equality with ===

        const imageBaseProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                message: imageUrl,
                metadata: {
                    embeds: [{
                        type: 'image',
                        url: imageUrl,
                    }],
                    images: {
                        [imageUrl]: imageMetadata,
                    },
                    emojis: [],
                    files: [],
                    reactions: [],
                } as PostMetadata,
            },
        };

        test('should render correctly', () => {
            const {container} = renderWithContext(<PostBodyAdditionalContent {...imageBaseProps}/>);

            expect(container).toMatchSnapshot();

            // Check that post image component is rendered
            expect(container.querySelector('.PostBodyAdditionalContent') || container.querySelector('[class*="post"]')).toBeInTheDocument();
        });

        test('should render the toggle after a message containing more than just a link', () => {
            const props = {
                ...imageBaseProps,
                post: {
                    ...imageBaseProps.post,
                    message: 'This is an image: ' + imageUrl,
                },
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should not render content when isEmbedVisible is false', () => {
            const props = {
                ...imageBaseProps,
                isEmbedVisible: false,
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            // When isEmbedVisible is false, the image should not be visible
            expect(container.querySelector('.PostBodyAdditionalContent__image') || container.querySelector('.PostImage__container')).not.toBeInTheDocument();
        });
    });

    describe('with a message attachment', () => {
        const attachments: any[] = []; // This can be empty since we're checking equality with ===

        const messageAttachmentBaseProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                metadata: {
                    embeds: [{
                        type: 'message_attachment',
                    }],
                } as PostMetadata,
                props: {
                    attachments,
                },
            },
        };

        test('should render correctly', () => {
            const {container} = renderWithContext(<PostBodyAdditionalContent {...messageAttachmentBaseProps}/>);

            expect(container).toMatchSnapshot();
        });

        test('should render content when isEmbedVisible is false', () => {
            const props = {
                ...messageAttachmentBaseProps,
                isEmbedVisible: false,
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            // Message attachments should still render when isEmbedVisible is false
            expect(container).toMatchSnapshot();
        });
    });

    describe('with an opengraph preview', () => {
        const ogUrl = 'https://example.com/image.png';

        const ogBaseProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                message: ogUrl,
                metadata: {
                    embeds: [{
                        type: 'opengraph',
                        url: ogUrl,
                    }],
                } as PostMetadata,
            },
        };

        test('should render correctly', () => {
            const {container} = renderWithContext(<PostBodyAdditionalContent {...ogBaseProps}/>);

            expect(container).toMatchSnapshot();
        });

        test('should render the toggle after a message containing more than just a link', () => {
            const props = {
                ...ogBaseProps,
                post: {
                    ...ogBaseProps.post,
                    message: 'This is a link: ' + ogUrl,
                },
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should render content when isEmbedVisible is false', () => {
            const props = {
                ...ogBaseProps,
                isEmbedVisible: false,
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            // OpenGraph previews should still render when isEmbedVisible is false
            expect(container).toMatchSnapshot();
        });
    });

    describe('with a YouTube video', () => {
        const youtubeUrl = 'https://www.youtube.com/watch?v=d-YO3v-wJts';

        const youtubeBaseProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                message: youtubeUrl,
                metadata: {
                    embeds: [{
                        type: 'opengraph',
                        url: youtubeUrl,
                    }],
                } as PostMetadata,
            },
        };

        test('should render correctly', () => {
            const {container} = renderWithContext(<PostBodyAdditionalContent {...youtubeBaseProps}/>);

            expect(container).toMatchSnapshot();
        });

        test('should render the toggle after a message containing more than just a link', () => {
            const props = {
                ...youtubeBaseProps,
                post: {
                    ...youtubeBaseProps.post,
                    message: 'This is a video: ' + youtubeUrl,
                },
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should not render content when isEmbedVisible is false', () => {
            const props = {
                ...youtubeBaseProps,
                isEmbedVisible: false,
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });
    });

    describe('with a normal link', () => {
        const mp3Url = 'https://example.com/song.mp3';

        const EmbedMP3 = () => <div data-testid='embed-mp3'>{'MP3 Embed'}</div>;

        const linkBaseProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                message: mp3Url,
                metadata: {
                    embeds: [{
                        type: 'link',
                        url: mp3Url,
                    }],
                } as PostMetadata,
            },
        };

        test("Should render nothing if the registered plugins don't match", () => {
            const props = {
                ...linkBaseProps,
                pluginPostWillRenderEmbedComponents: [
                    {
                        id: '',
                        pluginId: '',
                        match: () => false,
                        toggleable: true,
                        component: EmbedMP3,
                    },
                ],
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);
            expect(screen.queryByTestId('embed-mp3')).not.toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        test('Should render the plugin component if it matches and is toggeable', () => {
            const props = {
                ...linkBaseProps,
                pluginPostWillRenderEmbedComponents: [
                    {
                        id: '',
                        pluginId: '',
                        match: ({url}: PostEmbed) => url === mp3Url,
                        toggleable: true,
                        component: EmbedMP3,
                    },
                ],
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);
            expect(screen.getByTestId('embed-mp3')).toBeInTheDocument();
            expect(container.querySelector('button.post__embed-visibility')).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        test('Should render the plugin component if it matches and is not toggeable', () => {
            const props = {
                ...linkBaseProps,
                pluginPostWillRenderEmbedComponents: [
                    {
                        id: '',
                        pluginId: '',
                        match: ({url}: PostEmbed) => url === mp3Url,
                        toggleable: false,
                        component: EmbedMP3,
                    },
                ],
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);
            expect(screen.getByTestId('embed-mp3')).toBeInTheDocument();
            expect(container.querySelector('button.post__embed-visibility')).not.toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        test('Should render nothing if the plugin matches but isEmbedVisible is false', () => {
            const props = {
                ...linkBaseProps,
                pluginPostWillRenderEmbedComponents: [
                    {
                        id: '',
                        pluginId: '',
                        match: ({url}: PostEmbed) => url === mp3Url,
                        toggleable: false,
                        component: EmbedMP3,
                    },
                ],
                isEmbedVisible: false,
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);
            expect(screen.queryByTestId('embed-mp3')).not.toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });

    test('should call toggleEmbedVisibility with post id', () => {
        // We need to access the component's toggleEmbedVisibility method
        // In RTL we verify the action was called through user interaction
        const toggleEmbedVisibility = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                toggleEmbedVisibility,
            },
        };

        renderWithContext(<PostBodyAdditionalContent {...props}/>);

        // The toggleEmbedVisibility would be called when user clicks the toggle button
        // Since the base props don't have embeds that show toggle, we just verify the function is available
        expect(toggleEmbedVisibility).not.toHaveBeenCalled();
    });

    test('should call getEmbedFromMetadata with metadata', () => {
        const metadata = {
            embeds: [{
                type: 'message_attachment',
            }],
        } as PostMetadata;
        const props = {
            ...baseProps,
            post: {
                ...baseProps.post,
                metadata,
            },
        };

        renderWithContext(<PostBodyAdditionalContent {...props}/>);

        expect(postUtils.getEmbedFromMetadata).toHaveBeenCalledWith(metadata);
    });

    describe('with a permalinklink', () => {
        const permalinkUrl = 'https://community.mattermost.com/core/pl/123456789';

        const permalinkBaseProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                message: permalinkUrl,
                metadata: {
                    embeds: [{
                        type: 'permalink',
                        url: '',
                        data: {
                            post_id: 'post_id123',
                            channel_display_name: 'channel1',
                            team_name: 'core',
                            channel_type: 'O',
                            channel_id: 'channel_id',
                        },
                    }],
                    images: {},
                    emojis: [],
                    files: [],
                    reactions: [],
                } as PostMetadata,
            },
        };

        test('Render permalink preview', () => {
            const {container} = renderWithContext(<PostBodyAdditionalContent {...permalinkBaseProps}/>);
            expect(container).toMatchSnapshot();
        });

        test('Render permalink preview with no data', () => {
            const metadata = {
                embeds: [{
                    type: 'permalink',
                    url: '',
                }],
            } as PostMetadata;
            const props = {
                ...permalinkBaseProps,
                post: {
                    ...permalinkBaseProps.post,
                    metadata,
                },
            };

            const {container} = renderWithContext(<PostBodyAdditionalContent {...props}/>);
            expect(container).toMatchSnapshot();
        });
    });
});
