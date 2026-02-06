// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';

import DmListPage from '../index';

const mockStore = configureStore([]);

// Track dispatch calls
const mockDispatch = jest.fn((action) => action);

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
const mockCurrentTeamUrl = '/test-team';
const mockCurrentUserId = 'user1';
const mockDmChannels = [
    {
        type: 'dm' as const,
        channel: {id: 'dm1', name: 'user1__user2', type: 'D', teammate_id: 'user2', last_post_at: 2000},
        user: {id: 'user2', username: 'user2', nickname: '', first_name: '', last_name: ''},
    },
    {
        type: 'dm' as const,
        channel: {id: 'dm2', name: 'user1__user3', type: 'D', teammate_id: 'user3', last_post_at: 1000},
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
        // Second selector: getCurrentRelativeTeamUrl
        if (idx === 1) {
            return mockCurrentTeamUrl;
        }
        // Third selector: getCurrentUserId
        if (idx === 2) {
            return mockCurrentUserId;
        }
        // Fourth selector: getAllDmChannelsWithUsers
        return mockDmChannels;
    },
}));

// Mock react-virtualized-auto-sizer
jest.mock('react-virtualized-auto-sizer', () => ({
    __esModule: true,
    default: ({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) =>
        children({height: 500, width: 300}),
}));

// Mock getPosts action
const mockGetPosts = jest.fn().mockReturnValue({type: 'MOCK_GET_POSTS'});
jest.mock('mattermost-redux/actions/posts', () => ({
    getPosts: (...args: any[]) => mockGetPosts(...args),
}));

// Mock savePreferences action
const mockSavePreferences = jest.fn().mockReturnValue({type: 'MOCK_SAVE_PREFERENCES'});
jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: (...args: any[]) => mockSavePreferences(...args),
}));

// Mock leaveDirectChannel action
const mockLeaveDirectChannel = jest.fn().mockReturnValue({type: 'MOCK_LEAVE_DIRECT_CHANNEL'});
jest.mock('actions/views/channel', () => ({
    leaveDirectChannel: (...args: any[]) => mockLeaveDirectChannel(...args),
}));

// Mock modules that may have complex imports
jest.mock('actions/views/modals', () => ({
    openModal: jest.fn().mockReturnValue({type: 'MOCK_OPEN_MODAL'}),
}));
jest.mock('components/more_direct_channels', () => () => null);
jest.mock('utils/constants', () => ({
    ModalIdentifiers: {CREATE_DM_CHANNEL: 'create_dm_channel'},
    Constants: {
        DM_CHANNEL: 'D',
        GM_CHANNEL: 'G',
        Preferences: {
            CATEGORY_DIRECT_CHANNEL_SHOW: 'direct_channel_show',
            CATEGORY_GROUP_CHANNEL_SHOW: 'group_channel_show',
        },
    },
}));

// Mock child components - capture onClose prop
jest.mock('../dm_search_input', () => (props: any) => <input data-testid="dm-search-input" />);
jest.mock('components/enhanced_dm_row', () => ({channel, onClose}: any) => (
    <div data-testid={`dm-row-${channel.id}`}>
        {channel.name}
        <button data-testid={`close-dm-${channel.id}`} onClick={() => onClose?.(channel.id)}>close</button>
    </div>
));
jest.mock('components/enhanced_group_dm_row', () => ({channel, onClose}: any) => (
    <div data-testid={`gm-row-${channel.id}`}>
        {channel.name}
        <button data-testid={`close-gm-${channel.id}`} onClick={() => onClose?.(channel.id)}>close</button>
    </div>
));

describe('DmListPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSelectorCallCount = 0;
    });

    // BUG 3: DM list should dispatch an action to fetch latest posts for DM channels
    it('dispatches action to fetch latest DM posts on mount', () => {
        const store = mockStore({});
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <DmListPage />
                </BrowserRouter>
            </Provider>,
        );

        // Should dispatch getPosts for each DM channel
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockGetPosts).toHaveBeenCalledWith('dm1', 0, 1);
        expect(mockGetPosts).toHaveBeenCalledWith('dm2', 0, 1);
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

        // Should navigate to the most recent DM (first in list - user2)
        expect(mockPush).toHaveBeenCalledWith('/test-team/messages/@user2');
    });

    it('closes a DM conversation when close button is clicked', () => {
        const store = mockStore({});
        const {getByTestId} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <DmListPage />
                </BrowserRouter>
            </Provider>,
        );

        // Click close on the active DM (dm1)
        fireEvent.click(getByTestId('close-dm-dm1'));

        // Should dispatch leaveDirectChannel and savePreferences
        expect(mockLeaveDirectChannel).toHaveBeenCalledWith('user1__user2');
        expect(mockSavePreferences).toHaveBeenCalledWith('user1', [{
            user_id: 'user1',
            category: 'direct_channel_show',
            name: 'user2',
            value: 'false',
        }]);

        // Since dm1 is the active channel, should navigate to next DM
        expect(mockPush).toHaveBeenCalledWith('/test-team/messages/@user3');
    });
});
