// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {Post, PostEmbed} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/react_testing_utils';

import PostMessagePreview from './post_message_preview';
import type {Props} from './post_message_preview';

jest.mock('components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer', () => {
    return jest.fn(() => <div data-testid='post-preview-property-renderer-mock'>{'PostPreviewPropertyRenderer Mock'}</div>);
});

describe('PostMessagePreview', () => {
    const previewPost = {
        id: 'post_id',
        message: 'post message',
        metadata: {},
        channel_id: 'channel_id',
        create_at: new Date('2020-01-15T12:00:00Z').getTime(),
    } as Post;

    const user = {
        id: 'user_1',
        username: 'username1',
        roles: 'system_admin',
    } as UserProfile;

    const baseProps: Props = {
        metadata: {
            channel_display_name: 'channel name',
            team_name: 'team1',
            post_id: 'post_id',
            channel_type: 'O',
            channel_id: 'channel_id',
        },
        previewPost,
        user,
        hasImageProxy: false,
        enablePostIconOverride: false,
        isEmbedVisible: true,
        compactDisplay: false,
        currentTeamUrl: 'team1',
        channelDisplayName: 'channel name',
        handleFileDropdownOpened: jest.fn(),
        actions: {
            toggleEmbedVisibility: jest.fn(),
        },
        isPostPriorityEnabled: false,
        isChannelAutotranslated: false,
    };

    const baseState = {
        entities: {
            users: {
                currentUserId: user.id,
                profiles: {
                    [user.id]: user,
                },
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: {
                        id: 'team_id',
                        name: 'team1',
                    },
                },
            },
            channels: {
                channels: {
                    channel_id: {
                        id: 'channel_id',
                        team_id: 'team_id',
                        type: 'O' as ChannelType,
                        name: 'channel-name',
                        display_name: 'Channel Name',
                    },
                },
            },
            posts: {
                posts: {
                    [previewPost.id]: previewPost,
                },
            },
            preferences: {
                myPreferences: {},
            },
            general: {
                config: {},
            },
            roles: {
                roles: {
                    system_admin: {
                        permissions: [],
                    },
                },
            },
        },
    };

    test('should render correctly', () => {
        const {container} = renderWithContext(<PostMessagePreview {...baseProps}/>, baseState);
        expect(container).toMatchSnapshot();
    });

    test('should render without preview', () => {
        const {container} = renderWithContext(
            <PostMessagePreview
                {...baseProps}
                previewPost={undefined}
            />,
            baseState,
        );

        expect(container).toMatchSnapshot();
    });

    test('show render without preview when preview posts becomes undefined after being defined', () => {
        const props = {...baseProps};
        let renderResult = renderWithContext(
            <PostMessagePreview
                {...props}
            />,
            baseState,
        );

        expect(renderResult.container).toMatchSnapshot();
        let permalink = renderResult.container.querySelector('.attachment--permalink');
        expect(permalink).toBeInTheDocument();

        // now we'll set the preview post to undefined. This happens when the
        // previewed post is deleted.
        props.previewPost = undefined;

        renderResult = renderWithContext(
            <PostMessagePreview
                {...props}
            />,
            baseState,
        );
        expect(renderResult.container).toMatchSnapshot();
        permalink = renderResult.container.querySelector('.attachment--permalink');
        expect(permalink).not.toBeInTheDocument();
    });

    test('should not render bot icon', () => {
        const postProps = {
            override_icon_url: 'https://fakeicon.com/image.jpg',
            use_user_icon: 'false',
            from_webhook: 'false',
        };

        const postPreview = {
            ...previewPost,
            props: postProps,
        } as unknown as Post;

        const props = {
            ...baseProps,
            previewPost: postPreview,
        };
        const {container} = renderWithContext(
            <PostMessagePreview
                {...props}
            />,
            baseState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render bot icon', () => {
        const postProps = {
            override_icon_url: 'https://fakeicon.com/image.jpg',
            use_user_icon: false,
            from_webhook: 'true',
        };

        const postPreview = {
            ...previewPost,
            props: postProps,
        } as unknown as Post;

        const props = {
            ...baseProps,
            previewPost: postPreview,
            enablePostIconOverride: true,
        };
        const {container} = renderWithContext(
            <PostMessagePreview
                {...props}
            />,
            baseState,
        );

        expect(container).toMatchSnapshot();
    });

    describe('nested previews', () => {
        const files = {
            file_ids: [
                'file_1',
                'file_2',
            ],
        };

        const opengraphMetadata = {
            type: 'opengraph',
            url: 'https://example.com',
        } as PostEmbed;

        test('should render opengraph preview', () => {
            const postPreview = {
                ...previewPost,
                metadata: {
                    embeds: [opengraphMetadata],
                },
            } as Post;

            const props = {
                ...baseProps,
                previewPost: postPreview,
            };

            const {container} = renderWithContext(<PostMessagePreview {...props}/>, baseState);
            expect(container).toMatchSnapshot();
        });

        test('should render file preview', () => {
            const postPreview = {
                ...previewPost,
                ...files,
            } as Post;

            const props = {
                ...baseProps,
                previewPost: postPreview,
            };

            const {container} = renderWithContext(<PostMessagePreview {...props}/>, baseState);
            expect(container).toMatchSnapshot();
        });
    });

    describe('direct and group messages', () => {
        const channelTypes = [General.DM_CHANNEL, General.GM_CHANNEL] as ChannelType[];

        test.each(channelTypes)('should render preview for %s message', (type) => {
            const metadata = {
                ...baseProps.metadata,
                team_name: '',
                channel_type: type,
                channel_id: 'channel_id',
            };

            const props = {
                ...baseProps,
                metadata,
            };

            const {container} = renderWithContext(
                <PostMessagePreview
                    {...props}
                />,
                baseState,
            );

            expect(container).toMatchSnapshot();
        });
    });
});
