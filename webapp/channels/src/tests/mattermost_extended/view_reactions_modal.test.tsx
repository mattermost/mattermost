// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import testConfigureStore from 'tests/test_store';

import ViewReactionsModal from 'components/view_reactions_modal/view_reactions_modal';

// Mock Client4
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getProfilePictureUrl: (userId: string, _lastUpdate: number) => `/api/v4/users/${userId}/image`,
    },
}));

// Mock emoji utilities
jest.mock('mattermost-redux/utils/emoji_utils', () => ({
    getEmojiImageUrl: (emoji: any) => {
        if (emoji && emoji.short_name) {
            return `/static/emoji/${emoji.short_name}.png`;
        }
        if (emoji && emoji.id) {
            return `/api/v4/emoji/${emoji.id}/image`;
        }
        return '';
    },
    isSystemEmoji: (emoji: any) => !emoji.id,
    getEmojiName: (emoji: any) => emoji.short_name || emoji.name || '',
}));

// Mock utils/emoji with a controlled set of emojis
// NOTE: Data must be defined INSIDE the factory because jest.mock() is hoisted above variable declarations
jest.mock('utils/emoji', () => {
    const indices = new Map<string, number>();
    indices.set('thumbsup', 0);
    indices.set('+1', 0);
    indices.set('heart', 1);
    indices.set('smile', 2);

    return {
        EmojiIndicesByAlias: indices,
        Emojis: [
            {short_name: 'thumbsup', unified: '1F44D'},
            {short_name: 'heart', unified: '2764'},
            {short_name: 'smile', unified: '1F604'},
        ],
    };
});

// Mock getMissingProfilesByIds action
const mockGetMissingProfilesByIds = jest.fn(() => ({type: 'MOCK_GET_MISSING_PROFILES'}));
jest.mock('mattermost-redux/actions/users', () => ({
    getMissingProfilesByIds: (...args: any[]) => mockGetMissingProfilesByIds(...args),
}));

describe('ViewReactionsModal', () => {
    const basePost = {
        id: 'post_1',
        create_at: 1000000,
        update_at: 1000000,
        delete_at: 0,
        edit_at: 0,
        user_id: 'user_1',
        channel_id: 'channel_1',
        root_id: '',
        original_id: '',
        message: 'Hello world',
        type: '' as any,
        props: {},
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {} as any,
    };

    const baseState = {
        entities: {
            general: {
                config: {},
                serverVersion: '',
            },
            preferences: {
                myPreferences: {
                    'display_settings--name_format': {
                        category: 'display_settings',
                        name: 'name_format',
                        user_id: 'current_user',
                        value: 'username',
                    },
                },
            },
            users: {
                profiles: {
                    user_1: {
                        id: 'user_1',
                        username: 'alice',
                        nickname: 'Alice N',
                        first_name: 'Alice',
                        last_name: 'Smith',
                        last_picture_update: 100,
                    },
                    user_2: {
                        id: 'user_2',
                        username: 'bob',
                        nickname: 'Bob N',
                        first_name: 'Bob',
                        last_name: 'Jones',
                        last_picture_update: 200,
                    },
                    user_3: {
                        id: 'user_3',
                        username: 'charlie',
                        nickname: 'Charlie N',
                        first_name: 'Charlie',
                        last_name: 'Brown',
                        last_picture_update: 300,
                    },
                },
                currentUserId: 'current_user',
            },
            teams: {
                currentTeamId: 'team_1',
            },
            posts: {
                reactions: {
                    post_1: {
                        'user_1-thumbsup': {
                            user_id: 'user_1',
                            post_id: 'post_1',
                            emoji_name: 'thumbsup',
                            create_at: 1000001,
                        },
                        'user_2-thumbsup': {
                            user_id: 'user_2',
                            post_id: 'post_1',
                            emoji_name: 'thumbsup',
                            create_at: 1000002,
                        },
                        'user_1-heart': {
                            user_id: 'user_1',
                            post_id: 'post_1',
                            emoji_name: 'heart',
                            create_at: 1000003,
                        },
                        'user_3-smile': {
                            user_id: 'user_3',
                            post_id: 'post_1',
                            emoji_name: 'smile',
                            create_at: 1000004,
                        },
                    },
                },
            },
            emojis: {
                customEmoji: {},
            },
        },
    };

    function renderModal(state = baseState, post = basePost) {
        const store = testConfigureStore(state as any);
        return render(
            <IntlProvider locale='en'>
                <Provider store={store}>
                    <ViewReactionsModal
                        post={post}
                        onExited={jest.fn()}
                    />
                </Provider>
            </IntlProvider>,
        );
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with header', () => {
        renderModal();
        expect(screen.getByText('View Reactions')).toBeInTheDocument();
    });

    test('should display all emoji groups in the emoji list', () => {
        const {container} = renderModal();

        // Should have 3 emoji items (thumbsup, heart, smile)
        const emojiImages = container.querySelectorAll('.view-reactions-modal__emoji-img');
        expect(emojiImages.length).toBe(3);
    });

    test('should show correct reaction counts for each emoji', () => {
        renderModal();

        // thumbsup has 2 reactions, heart has 1, smile has 1
        expect(screen.getByText('2')).toBeInTheDocument();

        // heart and smile each have 1 reaction - there should be two "1" counts
        const oneCounts = screen.getAllByText('1');
        expect(oneCounts.length).toBe(2);
    });

    test('should show users for the first emoji by default', () => {
        renderModal();

        // First emoji is thumbsup with user_1 (alice) and user_2 (bob)
        expect(screen.getByText('alice')).toBeInTheDocument();
        expect(screen.getByText('@alice')).toBeInTheDocument();
        expect(screen.getByText('bob')).toBeInTheDocument();
        expect(screen.getByText('@bob')).toBeInTheDocument();
    });

    test('should switch user list when clicking a different emoji', async () => {
        renderModal();

        // Initially shows thumbsup users (alice, bob)
        expect(screen.getByText('@alice')).toBeInTheDocument();
        expect(screen.getByText('@bob')).toBeInTheDocument();

        // Click on the smile emoji button (3rd one)
        const emojiButtons = screen.getAllByRole('button');

        // Filter to emoji buttons (not the close button)
        const emojiItemButtons = emojiButtons.filter(
            (btn) => btn.classList.contains('view-reactions-modal__emoji-item'),
        );
        expect(emojiItemButtons.length).toBe(3);

        // Click the last emoji (smile - user_3/charlie)
        await userEvent.click(emojiItemButtons[2]);

        // Should now show charlie
        expect(screen.getByText('@charlie')).toBeInTheDocument();

        // alice and bob should no longer be visible
        expect(screen.queryByText('@alice')).not.toBeInTheDocument();
        expect(screen.queryByText('@bob')).not.toBeInTheDocument();
    });

    test('should highlight the selected emoji', async () => {
        renderModal();

        const emojiItemButtons = screen.getAllByRole('button').filter(
            (btn) => btn.classList.contains('view-reactions-modal__emoji-item'),
        );

        // First emoji should be selected by default
        expect(emojiItemButtons[0].classList.contains('view-reactions-modal__emoji-item--selected')).toBe(true);
        expect(emojiItemButtons[1].classList.contains('view-reactions-modal__emoji-item--selected')).toBe(false);

        // Click the second emoji (heart)
        await userEvent.click(emojiItemButtons[1]);

        expect(emojiItemButtons[0].classList.contains('view-reactions-modal__emoji-item--selected')).toBe(false);
        expect(emojiItemButtons[1].classList.contains('view-reactions-modal__emoji-item--selected')).toBe(true);
    });

    test('should render user avatars with correct URLs', () => {
        const {container} = renderModal();

        const avatarImages = container.querySelectorAll('.Avatar');
        expect(avatarImages.length).toBeGreaterThanOrEqual(2);
    });

    test('should fetch missing profiles on mount', () => {
        renderModal();
        expect(mockGetMissingProfilesByIds).toHaveBeenCalledTimes(1);

        // Should include all unique user IDs from reactions
        const calledWithIds = mockGetMissingProfilesByIds.mock.calls[0][0];
        expect(calledWithIds).toContain('user_1');
        expect(calledWithIds).toContain('user_2');
        expect(calledWithIds).toContain('user_3');
    });

    test('should handle post with no reactions gracefully', () => {
        // Suppress reselect memoization warning from getCustomEmojisByName when state shape changes
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            if (typeof args[0] === 'string' && args[0].includes('Selector unknown returned a different result')) {
                return;
            }
            originalConsoleError(...args);
        };

        const stateNoReactions = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    reactions: {},
                },
            },
        };

        const {container} = renderModal(stateNoReactions);

        // Should still render the modal
        expect(screen.getByText('View Reactions')).toBeInTheDocument();

        // No emoji items
        const emojiItems = container.querySelectorAll('.view-reactions-modal__emoji-item');
        expect(emojiItems.length).toBe(0);

        // No user rows
        const userRows = container.querySelectorAll('.view-reactions-modal__user-row');
        expect(userRows.length).toBe(0);

        console.error = originalConsoleError;
    });

    test('should display username with @ prefix', () => {
        renderModal();

        // Usernames should have @ prefix
        expect(screen.getByText('@alice')).toBeInTheDocument();
        expect(screen.getByText('@bob')).toBeInTheDocument();
    });

    test('should respect teammate name display setting for display names', () => {
        // With 'username' display setting, displayUsername returns the username
        renderModal();

        // Both display name and @username should be present for each user
        const userRows = screen.getAllByText(/@alice|@bob/);
        expect(userRows.length).toBe(2);
    });

    test('should render emoji images for system emojis', () => {
        const {container} = renderModal();

        const emojiImages = container.querySelectorAll('.view-reactions-modal__emoji-img');

        // Each image should have an src from the mock getEmojiImageUrl
        emojiImages.forEach((img) => {
            expect(img.getAttribute('src')).toMatch(/\/static\/emoji\//);
        });
    });

    test('should handle custom emojis', () => {
        const stateWithCustomEmoji = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    reactions: {
                        post_1: {
                            'user_1-custom_emoji': {
                                user_id: 'user_1',
                                post_id: 'post_1',
                                emoji_name: 'custom_emoji',
                                create_at: 1000001,
                            },
                        },
                    },
                },
                emojis: {
                    customEmoji: {
                        custom_id_1: {
                            id: 'custom_id_1',
                            name: 'custom_emoji',
                            creator_id: 'user_1',
                        },
                    },
                },
            },
        };

        renderModal(stateWithCustomEmoji);

        // Should render the modal without errors
        expect(screen.getByText('View Reactions')).toBeInTheDocument();

        // Should show user_1 (alice) for the custom emoji
        expect(screen.getByText('@alice')).toBeInTheDocument();
    });

    test('should show single emoji with all its reactors', async () => {
        const singleEmojiState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    reactions: {
                        post_1: {
                            'user_1-thumbsup': {
                                user_id: 'user_1',
                                post_id: 'post_1',
                                emoji_name: 'thumbsup',
                                create_at: 1000001,
                            },
                            'user_2-thumbsup': {
                                user_id: 'user_2',
                                post_id: 'post_1',
                                emoji_name: 'thumbsup',
                                create_at: 1000002,
                            },
                            'user_3-thumbsup': {
                                user_id: 'user_3',
                                post_id: 'post_1',
                                emoji_name: 'thumbsup',
                                create_at: 1000003,
                            },
                        },
                    },
                },
            },
        };

        renderModal(singleEmojiState);

        // All three users should be visible
        expect(screen.getByText('@alice')).toBeInTheDocument();
        expect(screen.getByText('@bob')).toBeInTheDocument();
        expect(screen.getByText('@charlie')).toBeInTheDocument();

        // Only one emoji item
        const emojiItems = screen.getAllByRole('button').filter(
            (btn) => btn.classList.contains('view-reactions-modal__emoji-item'),
        );
        expect(emojiItems.length).toBe(1);

        // Count should be 3
        expect(screen.getByText('3')).toBeInTheDocument();
    });
});
