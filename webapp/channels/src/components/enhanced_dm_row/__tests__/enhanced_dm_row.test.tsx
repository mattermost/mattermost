// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';

import EnhancedDmRow from '../index';

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
                myPreferences: {},
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

        // The href should be a relative path, not a full URL
        // This test would fail if getCurrentTeamUrl (full URL) was used instead of getCurrentRelativeTeamUrl
        expect(href).not.toContain('http://');
        expect(href).not.toContain('https://');
        expect(href).toMatch(/^\/[^/]/); // Should start with / followed by non-slash
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
                            msg_count: 5, // Less than total_msg_count (10)
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

        const avatar = container.querySelector('.enhanced-dm-row__avatar');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('alt', 'testuser avatar');
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
});
