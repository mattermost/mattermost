// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {Post, PostEmbed} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import PostMessagePreview from './post_message_preview';
import type {Props} from './post_message_preview';

vi.mock('components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer', () => {
    return {
        __esModule: true,
        default: vi.fn(() => <div data-testid='post-preview-property-renderer-mock'>{'PostPreviewPropertyRenderer Mock'}</div>),
    };
});

describe('PostMessagePreview', () => {
    beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
    });

    afterAll(() => {
        vi.useRealTimers();
    });
    const previewPost = {
        id: 'post_id',
        message: 'post message',
        metadata: {},
    } as Post;

    const user = {
        id: 'user_1',
        username: 'username1',
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
        handleFileDropdownOpened: vi.fn(),
        actions: {
            toggleEmbedVisibility: vi.fn(),
        },
        isPostPriorityEnabled: false,
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'user_1',
                profiles: {user_1: user},
            },
            channels: {},
            teams: {teams: {}},
            preferences: {myPreferences: {}},
            posts: {posts: {}},
            emojis: {customEmoji: {}},
            groups: {groups: {}, myGroups: []},
        },
    } as any;

    test('should render correctly', () => {
        const {container} = renderWithContext(<PostMessagePreview {...baseProps}/>, initialState);

        expect(container).toMatchSnapshot();
    });

    test('should render without preview', () => {
        const {container} = renderWithContext(
            <PostMessagePreview
                {...baseProps}
                previewPost={undefined}
            />,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('show render without preview when preview posts becomes undefined after being defined', () => {
        const props = {...baseProps};
        let result = renderWithContext(
            <PostMessagePreview
                {...props}
            />,
            initialState,
        );

        expect(result.container).toMatchSnapshot();
        let permalink = result.container.querySelector('.attachment--permalink');
        expect(permalink).toBeInTheDocument();

        // now we'll set the preview post to undefined. This happens when the
        // previewed post is deleted.
        props.previewPost = undefined;

        result = renderWithContext(
            <PostMessagePreview
                {...props}
            />,
            initialState,
        );
        expect(result.container).toMatchSnapshot();
        permalink = result.container.querySelector('.attachment--permalink');
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
            initialState,
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
            initialState,
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

            const {container} = renderWithContext(<PostMessagePreview {...props}/>, initialState);

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

            const {container} = renderWithContext(<PostMessagePreview {...props}/>, initialState);

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
                initialState,
            );

            expect(container).toMatchSnapshot();
        });
    });
});
