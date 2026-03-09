// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    Post,
    PostEmbed,
    PostImage,
    PostMetadata,
} from '@mattermost/types/posts';

import {getEmbedFromMetadata} from 'mattermost-redux/utils/post_utils';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import PostBodyAdditionalContent from './post_body_additional_content';
import type {Props} from './post_body_additional_content';

jest.mock('mattermost-redux/utils/post_utils', () => {
    const actual = jest.requireActual('mattermost-redux/utils/post_utils');
    return {
        ...actual,
        getEmbedFromMetadata: jest.fn(actual.getEmbedFromMetadata),
    };
});

jest.mock('components/post_view/post_image', () => ({
    __esModule: true,
    default: jest.fn((props: any) => (
        <div
            data-testid='post-image'
            data-image-metadata={props.imageMetadata ? 'present' : 'absent'}
        />
    )),
}));

jest.mock('components/post_view/message_attachments/message_attachment_list', () => ({
    __esModule: true,
    default: jest.fn(() => (
        <div data-testid='message-attachment-list'/>
    )),
}));

jest.mock('components/post_view/post_attachment_opengraph', () => ({
    __esModule: true,
    default: jest.fn(() => (
        <div data-testid='post-attachment-opengraph'/>
    )),
}));

jest.mock('components/youtube_video', () => {
    const MockYoutubeVideo: any = jest.fn(() => (
        <div data-testid='youtube-video'/>
    ));
    MockYoutubeVideo.isYoutubeLink = (link: string) => {
        return (/^https?:\/\/((www\.)?youtube\.com|youtu\.be)\/.+/).test(link);
    };
    return {__esModule: true, default: MockYoutubeVideo};
});

jest.mock('components/post_view/post_message_preview', () => ({
    __esModule: true,
    default: jest.fn(() => (
        <div data-testid='post-message-preview'/>
    )),
}));

jest.mock('client/web_websocket_client', () => ({
    __esModule: true,
    default: {},
}));

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
        handleFileDropdownOpened: jest.fn(),
        actions: {
            toggleEmbedVisibility: jest.fn(),
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
            const {container} = render(<PostBodyAdditionalContent {...imageBaseProps}/>);

            expect(container).toMatchSnapshot();
            expect(screen.getByTestId('post-image')).toBeInTheDocument();
        });

        test('should render the toggle after a message containing more than just a link', () => {
            const props = {
                ...imageBaseProps,
                post: {
                    ...imageBaseProps.post,
                    message: 'This is an image: ' + imageUrl,
                },
            };

            const {container} = render(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should not render content when isEmbedVisible is false', () => {
            const props = {
                ...imageBaseProps,
                isEmbedVisible: false,
            };

            render(<PostBodyAdditionalContent {...props}/>);

            expect(screen.queryByTestId('post-image')).not.toBeInTheDocument();
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
            const {container} = render(<PostBodyAdditionalContent {...messageAttachmentBaseProps}/>);

            expect(container).toMatchSnapshot();
            expect(screen.getByTestId('message-attachment-list')).toBeInTheDocument();
        });

        test('should render content when isEmbedVisible is false', () => {
            const props = {
                ...messageAttachmentBaseProps,
                isEmbedVisible: false,
            };

            render(<PostBodyAdditionalContent {...props}/>);

            expect(screen.getByTestId('message-attachment-list')).toBeInTheDocument();
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
            const {container} = render(<PostBodyAdditionalContent {...ogBaseProps}/>);

            expect(screen.getByTestId('post-attachment-opengraph')).toBeInTheDocument();
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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should render content when isEmbedVisible is false', () => {
            const props = {
                ...ogBaseProps,
                isEmbedVisible: false,
            };

            render(<PostBodyAdditionalContent {...props}/>);

            expect(screen.getByTestId('post-attachment-opengraph')).toBeInTheDocument();
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
            const {container} = render(<PostBodyAdditionalContent {...youtubeBaseProps}/>);

            expect(screen.getByTestId('youtube-video')).toBeInTheDocument();
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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should not render content when isEmbedVisible is false', () => {
            const props = {
                ...youtubeBaseProps,
                isEmbedVisible: false,
            };

            const {container} = render(<PostBodyAdditionalContent {...props}/>);

            expect(screen.queryByTestId('youtube-video')).not.toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });

    describe('with a normal link', () => {
        const mp3Url = 'https://example.com/song.mp3';

        const EmbedMP3 = () => <div data-testid='embed-mp3'/>;

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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);
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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);
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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);
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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);
            expect(screen.queryByTestId('embed-mp3')).not.toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });

    test('should call toggleEmbedVisibility with post id', async () => {
        const imageUrl = 'https://example.com/image.png';
        const props = {
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
                        [imageUrl]: {} as PostImage,
                    },
                    emojis: [],
                    files: [],
                    reactions: [],
                } as PostMetadata,
            },
        };

        render(<PostBodyAdditionalContent {...props}/>);

        const toggleButton = screen.getByRole('button', {name: 'Toggle Embed Visibility'});
        await userEvent.click(toggleButton);

        expect(baseProps.actions.toggleEmbedVisibility).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.toggleEmbedVisibility).toHaveBeenCalledWith('post_id_1');
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

        render(<PostBodyAdditionalContent {...props}/>);

        expect(getEmbedFromMetadata).toHaveBeenCalledWith(metadata);
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
            const {container} = render(<PostBodyAdditionalContent {...permalinkBaseProps}/>);
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

            const {container} = render(<PostBodyAdditionalContent {...props}/>);
            expect(container).toMatchSnapshot();
        });
    });
});
