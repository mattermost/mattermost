// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import UnreadDmAvatars from '../unread_dm_avatars';

const mockStore = configureStore([]);

// Mock react-router-dom useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: mockPush,
    }),
}));

// Mock react-redux - variables must be prefixed with 'mock'
let mockCallCount = 0;
let mockValues: any[] = [];

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
    useSelector: () => {
        const value = mockValues[mockCallCount] ?? [];
        mockCallCount++;
        return value;
    },
}));

describe('UnreadDmAvatars', () => {
    const baseState = {
        entities: {
            general: {config: {}},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockCallCount = 0;
        mockPush.mockClear();
        mockDispatch.mockClear();
        // UnreadDmAvatars calls useSelector: getUnreadDmChannelsWithUsers, getCurrentTeam
        mockValues = [[], {id: 'team1', name: 'test-team'}];
    });

    it('renders container element', () => {
        mockValues = [[]];
        mockCallCount = 0;
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars')).toBeInTheDocument();
    });

    it('renders nothing when no unread DMs', () => {
        mockValues = [[]];
        mockCallCount = 0;
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelectorAll('.unread-dm-avatars__avatar')).toHaveLength(0);
    });

    it('renders avatars for unread DMs', () => {
        mockValues = [[
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
        ]];
        mockCallCount = 0;
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
        mockValues = [manyUnreads];
        mockCallCount = 0;
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
        mockValues = [manyUnreads];
        mockCallCount = 0;
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        expect(container.querySelector('.unread-dm-avatars__overflow')).toBeInTheDocument();
        expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('shows unread count badge on avatars', () => {
        mockValues = [[
            {
                channel: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                user: {id: 'user2', username: 'user2', last_picture_update: 0},
                unreadCount: 5,
                status: 'online',
            },
        ]];
        mockCallCount = 0;
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const badge = container.querySelector('.unread-dm-avatars__badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('5');
    });

    it('caps badge display at 99+', () => {
        mockValues = [[
            {
                channel: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                user: {id: 'user2', username: 'user2', last_picture_update: 0},
                unreadCount: 150,
                status: 'online',
            },
        ]];
        mockCallCount = 0;
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const badge = container.querySelector('.unread-dm-avatars__badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('99+');
    });

    it('navigates to DM channel when avatar clicked', () => {
        const mockUnreadDms = [
            {
                channel: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                user: {id: 'user2', username: 'testuser', last_picture_update: 0},
                unreadCount: 1,
                status: 'online',
            },
        ];
        // getCurrentTeamUrl returns the full team URL path
        const mockCurrentTeamUrl = '/test-team';
        mockValues = [mockUnreadDms, mockCurrentTeamUrl];
        mockCallCount = 0;

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <UnreadDmAvatars />
            </Provider>,
        );

        const avatar = container.querySelector('.unread-dm-avatars__avatar');
        fireEvent.click(avatar!);

        // Should set DM mode and navigate to DM using messages/@username pattern
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/test-team/messages/@testuser');
    });
});
