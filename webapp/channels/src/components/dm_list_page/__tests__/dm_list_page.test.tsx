// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';

import DmListPage from '../index';

const mockStore = configureStore([]);

// Track dispatch calls
const mockDispatch = jest.fn((action) => {
    if (typeof action === 'function') {
        return action(mockDispatch);
    }
    return action;
});

// Mock useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: mockPush,
    }),
}));

// Selector call tracking
let mockSelectorCallCount = 0;
const mockCurrentChannelId = 'dm1';
const mockDmChannels = [
    {
        type: 'dm' as const,
        channel: {id: 'dm1', name: 'user1__user2', type: 'D', last_post_at: 2000},
        user: {id: 'user2', username: 'user2', nickname: '', first_name: '', last_name: ''},
    },
    {
        type: 'dm' as const,
        channel: {id: 'dm2', name: 'user1__user3', type: 'D', last_post_at: 1000},
        user: {id: 'user3', username: 'user3', nickname: '', first_name: '', last_name: ''},
    },
];

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
    useSelector: () => {
        const idx = mockSelectorCallCount;
        mockSelectorCallCount++;
        // First selector: getCurrentChannelId
        if (idx === 0) {
            return mockCurrentChannelId;
        }
        // Second selector: getAllDmChannelsWithUsers
        return mockDmChannels;
    },
}));

// Mock react-virtualized-auto-sizer
jest.mock('react-virtualized-auto-sizer', () => ({
    __esModule: true,
    default: ({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) =>
        children({height: 500, width: 300}),
}));

// Mock child components
jest.mock('../dm_list_header', () => (props: any) => <div data-testid="dm-list-header">Header</div>);
jest.mock('../dm_search_input', () => (props: any) => <input data-testid="dm-search-input" />);
jest.mock('components/enhanced_dm_row', () => ({channel}: any) => (
    <div data-testid={`dm-row-${channel.id}`}>{channel.name}</div>
));
jest.mock('components/enhanced_group_dm_row', () => ({channel}: any) => (
    <div data-testid={`gm-row-${channel.id}`}>{channel.name}</div>
));

describe('DmListPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSelectorCallCount = 0;
    });

    // BUG 3: DM list should dispatch an action to fetch latest posts for DM channels
    // Current code does NOT fetch posts, so all DMs show "No messages yet"
    it('dispatches action to fetch latest DM posts on mount', () => {
        const store = mockStore({});
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <DmListPage />
                </BrowserRouter>
            </Provider>,
        );

        // The component should dispatch at least one action to load posts for DM channels
        // Current implementation does NOT dispatch any action on mount
        expect(mockDispatch).toHaveBeenCalled();
    });

    // BUG 4: When opening DM mode, should auto-select (navigate to) the most recent DM
    it('auto-selects and navigates to the most recent DM on mount', () => {
        const store = mockStore({});
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <DmListPage />
                </BrowserRouter>
            </Provider>,
        );

        // Should navigate to the most recent DM (dm1 with user2, last_post_at: 2000)
        // Current implementation does NOT auto-navigate
        expect(mockPush).toHaveBeenCalled();
    });
});
