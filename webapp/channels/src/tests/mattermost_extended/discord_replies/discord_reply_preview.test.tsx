// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import type {Post} from '@mattermost/types/posts';

import DiscordReplyPreview from 'components/post/discord_reply_preview/discord_reply_preview';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({push: jest.fn()}),
}));

describe('tests/mattermost_extended/discord_replies/discord_reply_preview', () => {
    const baseState = {
        entities: {
            general: {
                config: {
                    FeatureFlagDiscordReplies: 'true',
                    SiteURL: 'http://localhost:8065',
                },
            },
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {id: 'team_id1', name: 'testteam'},
                },
            },
            users: {
                currentUserId: 'current_user_id',
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    const makePost = (replies: Array<{
        post_id: string;
        user_id: string;
        username: string;
        nickname: string;
        text: string;
        has_image: boolean;
        has_video: boolean;
        file_categories: string[];
    }>): Post => ({
        id: 'post_1',
        create_at: 0,
        update_at: 0,
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: 'user_1',
        channel_id: 'channel_1',
        root_id: '',
        original_id: '',
        message: 'Test message',
        type: '' as Post['type'],
        props: {
            discord_replies: replies,
        },
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {} as Post['metadata'],
    });

    function renderWithStore(post: Post) {
        const store = mockStore(baseState);
        return render(
            <Provider store={store}>
                <DiscordReplyPreview post={post}/>
            </Provider>,
        );
    }

    describe('emoji display for file categories', () => {
        test('should show image emoji for image category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Check this photo',
                has_image: true,
                has_video: false,
                file_categories: ['image'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/🖼️/)).toBeInTheDocument();
            expect(screen.getByText(/Check this photo/)).toBeInTheDocument();
        });

        test('should show video emoji for video category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Watch this clip',
                has_image: false,
                has_video: true,
                file_categories: ['video'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/🎥/)).toBeInTheDocument();
            expect(screen.getByText(/Watch this clip/)).toBeInTheDocument();
        });

        test('should show gif emoji for animated gif category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Funny reaction',
                has_image: true,
                has_video: false,
                file_categories: ['gif'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/🎞️/)).toBeInTheDocument();
        });

        test('should show audio emoji for audio category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'New track',
                has_image: false,
                has_video: false,
                file_categories: ['audio'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/🎵/)).toBeInTheDocument();
        });

        test('should show document emoji for document category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Here is the report',
                has_image: false,
                has_video: false,
                file_categories: ['document'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/📄/)).toBeInTheDocument();
        });

        test('should show archive emoji for archive category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Download this',
                has_image: false,
                has_video: false,
                file_categories: ['archive'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/📦/)).toBeInTheDocument();
        });

        test('should show code emoji for code category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Config file',
                has_image: false,
                has_video: false,
                file_categories: ['code'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/💻/)).toBeInTheDocument();
        });

        test('should show paperclip emoji for generic file category', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Some file',
                has_image: false,
                has_video: false,
                file_categories: ['file'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/📎/)).toBeInTheDocument();
        });

        test('should show multiple emojis for mixed categories', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Mixed content',
                has_image: true,
                has_video: true,
                file_categories: ['image', 'video'],
            }]);

            renderWithStore(post);

            expect(screen.getByText(/🖼️/)).toBeInTheDocument();
            expect(screen.getByText(/🎥/)).toBeInTheDocument();
        });

        test('should show only emojis when text is empty', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: '',
                has_image: true,
                has_video: false,
                file_categories: ['image'],
            }]);

            renderWithStore(post);

            expect(screen.getByText('🖼️')).toBeInTheDocument();
        });

        test('should show plain text when no file categories', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Just a message',
                has_image: false,
                has_video: false,
                file_categories: [],
            }]);

            renderWithStore(post);

            const textEl = screen.getByText('Just a message');
            expect(textEl).toBeInTheDocument();
            expect(textEl.textContent).not.toMatch(/🖼️|🎥|🎞️|🎵|📄|📦|💻|📎/);
        });
    });

    describe('backward compatibility', () => {
        test('should handle reply data without file_categories field (old posts)', () => {
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Old format post',
                has_image: true,
                has_video: false,
            } as any]); // eslint-disable-line @typescript-eslint/no-explicit-any

            renderWithStore(post);

            // Should still render without crashing
            expect(screen.getByText('Old format post')).toBeInTheDocument();
        });
    });

    describe('rendering', () => {
        test('should not render when feature is disabled', () => {
            const state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    general: {
                        config: {
                            FeatureFlagDiscordReplies: 'false',
                        },
                    },
                },
            };
            const store = mockStore(state);
            const post = makePost([{
                post_id: 'reply_1',
                user_id: 'user_2',
                username: 'alice',
                nickname: 'Alice',
                text: 'Some text',
                has_image: false,
                has_video: false,
                file_categories: [],
            }]);

            const {container} = render(
                <Provider store={store}>
                    <DiscordReplyPreview post={post}/>
                </Provider>,
            );

            expect(container.querySelector('.discord-reply-preview')).not.toBeInTheDocument();
        });

        test('should not render when no replies', () => {
            const post = makePost([]);

            const {container} = renderWithStore(post);

            expect(container.querySelector('.discord-reply-preview')).not.toBeInTheDocument();
        });

        test('should render connector SVGs for each reply', () => {
            const post = makePost([
                {
                    post_id: 'reply_1',
                    user_id: 'user_2',
                    username: 'alice',
                    nickname: 'Alice',
                    text: 'First reply',
                    has_image: false,
                    has_video: false,
                    file_categories: [],
                },
                {
                    post_id: 'reply_2',
                    user_id: 'user_3',
                    username: 'bob',
                    nickname: 'Bob',
                    text: 'Second reply',
                    has_image: false,
                    has_video: false,
                    file_categories: [],
                },
            ]);

            const {container} = renderWithStore(post);

            const connectors = container.querySelectorAll('.discord-reply-connector');
            expect(connectors).toHaveLength(2);
        });

        test('should display username for each reply', () => {
            const post = makePost([
                {
                    post_id: 'reply_1',
                    user_id: 'user_2',
                    username: 'alice',
                    nickname: 'Alice',
                    text: 'Hello',
                    has_image: false,
                    has_video: false,
                    file_categories: [],
                },
            ]);

            renderWithStore(post);

            expect(screen.getByText('Alice:')).toBeInTheDocument();
        });
    });
});
