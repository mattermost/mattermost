// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import MembersTab from '../members_tab';

const mockStore = configureStore([]);

// Mock react-virtualized-auto-sizer
jest.mock('react-virtualized-auto-sizer', () => ({
    __esModule: true,
    default: ({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) =>
        children({height: 500, width: 300}),
}));

// Mock react-redux useSelector - variables must be prefixed with 'mock'
let mockChannel: any = null;
let mockGroupedMembers: any = null;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: any) => {
        // Check if it's the getCurrentChannel selector
        if (selector.toString().includes('getCurrentChannel') || mockChannel !== undefined) {
            const result = mockChannel;
            mockChannel = undefined; // Reset for next call
            if (result !== undefined) {
                return result;
            }
        }
        // Return groupedMembers for the second call
        return mockGroupedMembers;
    },
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

        // Should not show "No members"
        expect(screen.queryByText('No members')).not.toBeInTheDocument();

        // Should show group headers
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

        // Should show Member header
        expect(screen.getByText('Member — 1')).toBeInTheDocument();

        // Should not show Admin or Offline headers
        expect(screen.queryByText(/Admin —/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Offline —/)).not.toBeInTheDocument();
    });
});
