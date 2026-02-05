// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import UnreadDmAvatars from '../unread_dm_avatars';

jest.mock('selectors/views/guilded_layout', () => ({
    getUnreadDmChannelsWithUsers: jest.fn(),
}));

import {getUnreadDmChannelsWithUsers} from 'selectors/views/guilded_layout';

const mockGetUnreadDmChannelsWithUsers = getUnreadDmChannelsWithUsers as jest.Mock;

const mockStore = configureStore([]);

describe('UnreadDmAvatars', () => {
    const baseState = {
        entities: {
            general: {
                config: {},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders container element', () => {
        mockGetUnreadDmChannelsWithUsers.mockReturnValue([]);
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars')).toBeInTheDocument();
    });

    it('renders nothing when no unread DMs', () => {
        mockGetUnreadDmChannelsWithUsers.mockReturnValue([]);
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelectorAll('.unread-dm-avatars__avatar')).toHaveLength(0);
    });

    it('renders avatars for unread DMs', () => {
        mockGetUnreadDmChannelsWithUsers.mockReturnValue([
            {
                channel: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 2000},
                user: {id: 'user2', username: 'user2', last_picture_update: 0},
                unreadCount: 3,
                status: 'online',
            },
            {
                channel: {id: 'dm2', type: 'D', name: 'currentUser__user3', last_post_at: 1000},
                user: {id: 'user3', username: 'user3', last_picture_update: 0},
                unreadCount: 1,
                status: 'away',
            },
        ]);
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const avatars = container.querySelectorAll('.unread-dm-avatars__avatar');
        expect(avatars.length).toBeGreaterThan(0);
    });

    it('limits avatars to max 5', () => {
        const manyUnreads = [];
        for (let i = 1; i <= 8; i++) {
            manyUnreads.push({
                channel: {id: `dm${i}`, type: 'D', name: `currentUser__user${i}`, last_post_at: i * 1000},
                user: {id: `user${i}`, username: `user${i}`, last_picture_update: 0},
                unreadCount: 1,
                status: 'online',
            });
        }
        mockGetUnreadDmChannelsWithUsers.mockReturnValue(manyUnreads);
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const avatars = container.querySelectorAll('.unread-dm-avatars__avatar');
        expect(avatars.length).toBeLessThanOrEqual(5);
    });

    it('shows overflow indicator when more than 5 unread DMs', () => {
        const manyUnreads = [];
        for (let i = 1; i <= 8; i++) {
            manyUnreads.push({
                channel: {id: `dm${i}`, type: 'D', name: `currentUser__user${i}`, last_post_at: i * 1000},
                user: {id: `user${i}`, username: `user${i}`, last_picture_update: 0},
                unreadCount: 1,
                status: 'online',
            });
        }
        mockGetUnreadDmChannelsWithUsers.mockReturnValue(manyUnreads);
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars__overflow')).toBeInTheDocument();
        expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('shows status indicator on avatars', () => {
        mockGetUnreadDmChannelsWithUsers.mockReturnValue([
            {
                channel: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                user: {id: 'user2', username: 'user2', last_picture_update: 0},
                unreadCount: 1,
                status: 'online',
            },
        ]);
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars__status')).toBeInTheDocument();
    });
});
