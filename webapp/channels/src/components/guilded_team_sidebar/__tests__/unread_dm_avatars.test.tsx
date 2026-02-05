// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import UnreadDmAvatars from '../unread_dm_avatars';

const mockStore = configureStore([]);

describe('UnreadDmAvatars', () => {
    const baseState = {
        entities: {
            channels: {
                channels: {},
                myMembers: {},
            },
            users: {
                profiles: {},
                statuses: {},
                currentUserId: 'currentUser',
            },
            general: {
                config: {},
            },
        },
    };

    it('renders container element', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars')).toBeInTheDocument();
    });

    it('renders nothing when no unread DMs', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelectorAll('.unread-dm-avatars__avatar')).toHaveLength(0);
    });

    it('renders avatars for unread DMs', () => {
        const stateWithUnreads = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: {
                        dm1: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 2000},
                        dm2: {id: 'dm2', type: 'D', name: 'currentUser__user3', last_post_at: 1000},
                    },
                    myMembers: {
                        dm1: {channel_id: 'dm1', mention_count: 3},
                        dm2: {channel_id: 'dm2', mention_count: 1},
                    },
                },
                users: {
                    profiles: {
                        user2: {id: 'user2', username: 'user2', last_picture_update: 0},
                        user3: {id: 'user3', username: 'user3', last_picture_update: 0},
                    },
                    statuses: {
                        user2: 'online',
                        user3: 'away',
                    },
                    currentUserId: 'currentUser',
                },
            },
        };
        const store = mockStore(stateWithUnreads);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const avatars = container.querySelectorAll('.unread-dm-avatars__avatar');
        expect(avatars.length).toBeGreaterThan(0);
    });

    it('limits avatars to max 5', () => {
        const manyDms: Record<string, any> = {};
        const manyMembers: Record<string, any> = {};
        const manyProfiles: Record<string, any> = {};
        const manyStatuses: Record<string, any> = {};

        for (let i = 1; i <= 8; i++) {
            const dmId = `dm${i}`;
            const oderId = `user${i}`;
            manyDms[dmId] = {id: dmId, type: 'D', name: `currentUser__${oderId}`, last_post_at: i * 1000};
            manyMembers[dmId] = {channel_id: dmId, mention_count: 1};
            manyProfiles[oderId] = {id: oderId, username: oderId, last_picture_update: 0};
            manyStatuses[oderId] = 'online';
        }

        const stateWithManyUnreads = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: manyDms,
                    myMembers: manyMembers,
                },
                users: {
                    profiles: manyProfiles,
                    statuses: manyStatuses,
                    currentUserId: 'currentUser',
                },
            },
        };
        const store = mockStore(stateWithManyUnreads);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const avatars = container.querySelectorAll('.unread-dm-avatars__avatar');
        expect(avatars.length).toBeLessThanOrEqual(5);
    });

    it('shows overflow indicator when more than 5 unread DMs', () => {
        const manyDms: Record<string, any> = {};
        const manyMembers: Record<string, any> = {};
        const manyProfiles: Record<string, any> = {};
        const manyStatuses: Record<string, any> = {};

        for (let i = 1; i <= 8; i++) {
            const dmId = `dm${i}`;
            const oderId = `user${i}`;
            manyDms[dmId] = {id: dmId, type: 'D', name: `currentUser__${oderId}`, last_post_at: i * 1000};
            manyMembers[dmId] = {channel_id: dmId, mention_count: 1};
            manyProfiles[oderId] = {id: oderId, username: oderId, last_picture_update: 0};
            manyStatuses[oderId] = 'online';
        }

        const stateWithManyUnreads = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: manyDms,
                    myMembers: manyMembers,
                },
                users: {
                    profiles: manyProfiles,
                    statuses: manyStatuses,
                    currentUserId: 'currentUser',
                },
            },
        };
        const store = mockStore(stateWithManyUnreads);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars__overflow')).toBeInTheDocument();
        expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('shows status indicator on avatars', () => {
        const stateWithUnreads = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: {
                        dm1: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                    },
                    myMembers: {
                        dm1: {channel_id: 'dm1', mention_count: 1},
                    },
                },
                users: {
                    profiles: {
                        user2: {id: 'user2', username: 'user2', last_picture_update: 0},
                    },
                    statuses: {
                        user2: 'online',
                    },
                    currentUserId: 'currentUser',
                },
            },
        };
        const store = mockStore(stateWithUnreads);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars__status')).toBeInTheDocument();
    });
});
