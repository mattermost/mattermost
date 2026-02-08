// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';

import EnhancedDmRow from 'components/enhanced_dm_row/index';

const mockStore = configureStore([]);

describe('EnhancedDmRow', () => {
    const mockChannel = {
        id: 'dm1',
        name: 'user1__user2',
        display_name: 'Test User',
        type: 'D' as const,
        team_id: '',
        total_msg_count: 10,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        header: '',
        purpose: '',
        last_post_at: 1000,
        creator_id: '',
        scheme_id: '',
        group_constrained: false,
    };

    const mockUser = {
        id: 'user2',
        username: 'testuser',
        nickname: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.com',
        last_picture_update: 0,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        auth_service: '',
        roles: 'system_user',
        locale: 'en',
        notify_props: {} as any,
        position: '',
        timezone: {} as any,
    };

    const baseState = {
        entities: {
            general: {config: {}},
            teams: {
                teams: {
                    team1: {id: 'team1', name: 'test-team', display_name: 'Test Team'},
                },
                currentTeamId: 'team1',
            },
            channels: {
                myMembers: {
                    dm1: {
                        channel_id: 'dm1',
                        user_id: 'user1',
                        msg_count: 5,
                        mention_count: 0,
                        notify_props: {},
                    },
                },
            },
            users: {
                profiles: {
                    user1: {id: 'user1', username: 'currentuser'},
                    user2: mockUser,
                },
                statuses: {
                    user2: 'online',
                },
                currentUserId: 'user1',
            },
            posts: {
                posts: {},
                postsInChannel: {},
            },
            preferences: {
                myPreferences: {
                    'display_settings--name_format': {
                        category: 'display_settings',
                        name: 'name_format',
                        value: 'nickname_full_name',
                    },
                },
            },
            emojis: {
                customEmoji: {},
            },
        },
        views: {
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: [],
            },
        },
    };

    it('renders with correct link to DM', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const link = container.querySelector('a.enhanced-dm-row');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/test-team/messages/@testuser');
    });

    it('uses relative URL path, not full URL with protocol', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const link = container.querySelector('a.enhanced-dm-row');
        const href = link?.getAttribute('href') || '';
        expect(href).not.toContain('http://');
        expect(href).not.toContain('https://');
        expect(href).toMatch(/^\/[^/]/);
    });

    it('applies active class when isActive is true', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={true}
                    />
                </BrowserRouter>
            </Provider>,
        );

        expect(container.querySelector('.enhanced-dm-row--active')).toBeInTheDocument();
    });

    it('shows unread styling when channel has unread messages', () => {
        const unreadState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    myMembers: {
                        dm1: {
                            channel_id: 'dm1',
                            user_id: 'user1',
                            msg_count: 5,
                            mention_count: 0,
                            notify_props: {},
                        },
                    },
                },
            },
        };

        const store = mockStore(unreadState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        expect(container.querySelector('.enhanced-dm-row--unread')).toBeInTheDocument();
    });

    it('displays user avatar', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const avatarContainer = container.querySelector('.enhanced-dm-row__avatar');
        expect(avatarContainer).toBeInTheDocument();

        // ProfilePicture renders an Avatar img inside status-wrapper
        const avatarImg = avatarContainer?.querySelector('img.Avatar');
        expect(avatarImg).toBeInTheDocument();
    });

    it('displays user nickname or username', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        expect(container.querySelector('.enhanced-dm-row__display-name')?.textContent).toBe('Test User');
    });

    it('shows mention badge when there are mentions', () => {
        const mentionState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    myMembers: {
                        dm1: {
                            channel_id: 'dm1',
                            user_id: 'user1',
                            msg_count: 10,
                            mention_count: 3,
                            notify_props: {},
                        },
                    },
                },
            },
        };

        const store = mockStore(mentionState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const badge = container.querySelector('.enhanced-dm-row__badge');
        expect(badge).toBeInTheDocument();
        expect(badge?.textContent).toBe('3');
    });

    it('shows "Loading..." when channel has posts but they are not loaded yet', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');
        expect(preview?.textContent).toBe('Loading...');
    });

    it('shows "No messages yet" when channel has never had posts (last_post_at is 0)', () => {
        const emptyChannel = {...mockChannel, last_post_at: 0};
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={emptyChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');
        expect(preview?.textContent).toBe('No messages yet');
    });

    it('shows message preview without prefix when last post is from the other user', () => {
        const stateWithPost = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'dm1',
                            user_id: 'user2',
                            message: 'Hello there!',
                            create_at: 1000,
                        },
                    },
                    postsInChannel: {
                        dm1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(stateWithPost);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');
        expect(preview?.textContent).toBe('Hello there!');
    });

    it('shows "You: " prefix when last post is from the current user', () => {
        const stateWithOwnPost = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'dm1',
                            user_id: 'user1',
                            message: 'Hey!',
                            create_at: 1000,
                        },
                    },
                    postsInChannel: {
                        dm1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(stateWithOwnPost);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');
        expect(preview?.textContent).toBe('You: Hey!');
    });

    it('renders status icon via ProfilePicture', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        // ProfilePicture renders status inside a status-wrapper container
        const statusWrapper = container.querySelector('.status-wrapper');
        expect(statusWrapper).toBeInTheDocument();

        const status = container.querySelector('.status');
        expect(status).toBeInTheDocument();
    });

    it('strips blockquotes from message preview', () => {
        const stateWithBlockquote = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'dm1',
                            user_id: 'user2',
                            message: '>[@revlis](https://example.com): quoted text\n\nreply test\n\n> blockquote',
                            create_at: 1000,
                        },
                    },
                    postsInChannel: {
                        dm1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(stateWithBlockquote);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');
        expect(preview?.textContent).toBe('reply test');
    });

    it('strips blockquotes from own message preview with You: prefix', () => {
        const stateWithBlockquote = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'dm1',
                            user_id: 'user1',
                            message: '> quoted\nmy reply',
                            create_at: 1000,
                        },
                    },
                    postsInChannel: {
                        dm1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(stateWithBlockquote);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');
        expect(preview?.textContent).toBe('You: my reply');
    });

    it('renders emoji shortcodes as emoticon spans in preview', () => {
        const stateWithEmoji = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'dm1',
                            user_id: 'user2',
                            message: 'hello :smile: world',
                            create_at: 1000,
                        },
                    },
                    postsInChannel: {
                        dm1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(stateWithEmoji);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');

        // The emoticon span should be rendered for the :smile: emoji
        const emoticon = preview?.querySelector('.emoticon');
        expect(emoticon).toBeInTheDocument();
        expect(emoticon?.getAttribute('data-emoticon')).toBe('smile');

        // Text around the emoji should still be present
        expect(preview?.textContent).toContain('hello');
        expect(preview?.textContent).toContain('world');
    });

    it('renders emoji and strips blockquotes together', () => {
        const stateWithBoth = {
            ...baseState,
            entities: {
                ...baseState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'dm1',
                            user_id: 'user2',
                            message: '>[@someone](https://example.com): quoted

reply test :face_with_cowboy_hat:

> blockquote',
                            create_at: 1000,
                        },
                    },
                    postsInChannel: {
                        dm1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(stateWithBoth);
        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <EnhancedDmRow
                        channel={mockChannel}
                        user={mockUser}
                        isActive={false}
                    />
                </BrowserRouter>
            </Provider>,
        );

        const preview = container.querySelector('.enhanced-dm-row__preview');

        // Blockquotes should be stripped, only "reply test" + emoji remain
        expect(preview?.textContent).toContain('reply test');
        expect(preview?.textContent).not.toContain('quoted');
        expect(preview?.textContent).not.toContain('blockquote');

        // Emoji should be rendered as emoticon span
        const emoticon = preview?.querySelector('.emoticon');
        expect(emoticon).toBeInTheDocument();
        expect(emoticon?.getAttribute('data-emoticon')).toBe('face_with_cowboy_hat');
    });
});
