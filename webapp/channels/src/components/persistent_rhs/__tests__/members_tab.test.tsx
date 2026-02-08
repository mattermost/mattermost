// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import MembersTab from '../members_tab';

const mockStore = configureStore([]);

// Mock react-redux
let mockChannel: any = null;
let mockGroupedMembers: any = null;
const mockDispatch = jest.fn((action) => action);

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: any) => {
        if (selector.toString().includes('getCurrentChannel') || mockChannel !== undefined) {
            const result = mockChannel;
            mockChannel = undefined;
            if (result !== undefined) {
                return result;
            }
        }
        return mockGroupedMembers;
    },
    useDispatch: () => mockDispatch,
}));

// Mock the actual actions used by the component
const mockGetProfilesInChannel = jest.fn().mockReturnValue(Promise.resolve({data: []}));
const mockGetChannelMembers = jest.fn().mockReturnValue({type: 'MOCK_GET_CHANNEL_MEMBERS'});

jest.mock('mattermost-redux/actions/users', () => ({
    getProfilesInChannel: (...args: any[]) => mockGetProfilesInChannel(...args),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    getChannelMembers: (...args: any[]) => mockGetChannelMembers(...args),
}));

// Mock MemberRow component
jest.mock('../member_row', () => ({user, status, isAdmin}: any) => (
    <div className="member-row" data-testid={`member-${user.username}`}>
        <span>{user.username}</span>
        <span>{status}</span>
        {isAdmin && <span>Admin</span>}
    </div>
));

describe('MembersTab', () => {
    const baseState = {
        entities: {
            general: {config: {}},
            channels: {
                currentChannelId: 'channel1',
                channels: {
                    channel1: {id: 'channel1', name: 'channel1'},
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockChannel = {id: 'channel1', name: 'channel1'};
        mockGroupedMembers = null;
    });

    it('shows "No members" when groupedMembers is null', () => {
        mockGroupedMembers = null;

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <MembersTab />
            </Provider>,
        );

        expect(screen.getByText('No members')).toBeInTheDocument();
    });

    it('shows "No members" when all groups are empty', () => {
        mockGroupedMembers = {
            onlineAdmins: [],
            onlineMembers: [],
            offline: [],
        };

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <MembersTab />
            </Provider>,
        );

        expect(screen.getByText('No members')).toBeInTheDocument();
    });

    it('shows members grouped by status when data is available', () => {
        mockGroupedMembers = {
            onlineAdmins: [
                {user: {id: 'user1', username: 'admin1'}, status: 'online', isAdmin: true},
            ],
            onlineMembers: [
                {user: {id: 'user2', username: 'member1'}, status: 'online', isAdmin: false},
            ],
            offline: [
                {user: {id: 'user3', username: 'offline1'}, status: 'offline', isAdmin: false},
            ],
        };

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <MembersTab />
            </Provider>,
        );

        expect(screen.queryByText('No members')).not.toBeInTheDocument();
        expect(screen.getByText('Admin — 1')).toBeInTheDocument();
        expect(screen.getByText('Member — 1')).toBeInTheDocument();
        expect(screen.getByText('Offline — 1')).toBeInTheDocument();
    });

    it('only shows groups that have members', () => {
        mockGroupedMembers = {
            onlineAdmins: [],
            onlineMembers: [
                {user: {id: 'user1', username: 'member1'}, status: 'online', isAdmin: false},
            ],
            offline: [],
        };

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <MembersTab />
            </Provider>,
        );

        expect(screen.getByText('Member — 1')).toBeInTheDocument();
        expect(screen.queryByText(/Admin —/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Offline —/)).not.toBeInTheDocument();
    });

    it('dispatches getProfilesInChannel and getChannelMembers on mount', () => {
        mockGroupedMembers = null;

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <MembersTab />
            </Provider>,
        );

        // Should dispatch both actions to load profiles and channel memberships
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockGetProfilesInChannel).toHaveBeenCalledWith('channel1', 0, 100);
        expect(mockGetChannelMembers).toHaveBeenCalledWith('channel1');
    });
});
