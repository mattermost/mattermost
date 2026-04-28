// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {fetchChannelsAndMembers, getChannelStats} from 'mattermost-redux/actions/channels';
import {fetchTeamScheduledPosts} from 'mattermost-redux/actions/scheduled_posts';
import {selectTeam} from 'mattermost-redux/actions/teams';

import {useTeamByName} from 'components/common/hooks/use_team';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {getPopoutChannelTitle} from './channel_popout';

import ChannelPopout from './index';

const MOCK_ACTION = {type: 'MOCK'};

jest.mock('mattermost-redux/actions/channel_categories', () => ({
    fetchMyCategories: jest.fn(() => MOCK_ACTION),
}));
jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    fetchChannelsAndMembers: jest.fn(() => MOCK_ACTION),
    getChannelStats: jest.fn(() => MOCK_ACTION),
}));
jest.mock('mattermost-redux/actions/scheduled_posts', () => ({
    fetchTeamScheduledPosts: jest.fn(() => MOCK_ACTION),
}));
jest.mock('mattermost-redux/actions/teams', () => ({
    selectTeam: jest.fn(() => MOCK_ACTION),
}));
jest.mock('components/common/hooks/use_team', () => ({
    useTeamByName: jest.fn(),
}));
jest.mock('utils/popouts/use_popout_title', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('components/channel_layout/channel_identifier_router', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-identifier-router'>{'ChannelIdentifierRouter'}</div>,
}));
jest.mock('components/sidebar_right', () => ({
    __esModule: true,
    default: () => <div data-testid='sidebar-right'>{'SidebarRight'}</div>,
}));
jest.mock('components/unreads_status_handler', () => ({
    __esModule: true,
    default: () => <div data-testid='unreads-status-handler'>{'UnreadsStatusHandler'}</div>,
}));
jest.mock('components/loading_screen', () => ({
    __esModule: true,
    default: () => <div data-testid='loading-screen'>{'LoadingScreen'}</div>,
}));

describe('ChannelPopout', () => {
    const team = TestHelper.getTeamMock({id: 'team_id', name: 'test-team'});
    const channel = TestHelper.getChannelMock({id: 'channel_id', name: 'town-square', type: 'O'});

    const baseState = {
        entities: {
            channels: {
                currentChannelId: channel.id,
                channels: {[channel.id]: channel},
                channelsInTeam: {},
                myMembers: {},
            },
            teams: {
                currentTeamId: team.id,
                teams: {[team.id]: team},
                myMembers: {},
            },
            users: {currentUserId: 'user_id', profiles: {}},
            general: {config: {}},
            preferences: {myPreferences: {}},
            roles: {roles: {}},
        },
        views: {
            rhs: {isSidebarOpen: false},
        },
    };

    function renderPopout(url: string) {
        return renderWithContext(
            <MemoryRouter initialEntries={[url]}>
                <Route path='/_popout/channel/:team/:path(channels|messages)/:identifier/:postid?'>
                    <ChannelPopout/>
                </Route>
            </MemoryRouter>,
            baseState,
        );
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should show loading screen when team is not found', () => {
        jest.mocked(useTeamByName).mockReturnValue(undefined);
        renderPopout('/_popout/channel/test-team/channels/town-square');
        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    });

    test('should render ChannelIdentifierRouter and SidebarRight when team is resolved', () => {
        jest.mocked(useTeamByName).mockReturnValue(team);
        renderPopout('/_popout/channel/test-team/channels/town-square');

        expect(screen.getByTestId('channel-identifier-router')).toBeInTheDocument();
        expect(screen.getByTestId('sidebar-right')).toBeInTheDocument();
    });

    test('should dispatch team bootstrapping actions when team is resolved', async () => {
        jest.mocked(useTeamByName).mockReturnValue(team);
        renderPopout('/_popout/channel/test-team/channels/town-square');

        await waitFor(() => {
            expect(jest.mocked(selectTeam)).toHaveBeenCalledWith('team_id');
            expect(jest.mocked(fetchChannelsAndMembers)).toHaveBeenCalledWith('team_id');
            expect(jest.mocked(fetchMyCategories)).toHaveBeenCalledWith('team_id');
            expect(jest.mocked(fetchTeamScheduledPosts)).toHaveBeenCalledWith('team_id', true);
        });
    });

    test('should dispatch getChannelStats when channel is available', async () => {
        jest.mocked(useTeamByName).mockReturnValue(team);
        renderPopout('/_popout/channel/test-team/channels/town-square');

        await waitFor(() => {
            expect(jest.mocked(getChannelStats)).toHaveBeenCalledWith('channel_id');
        });
    });

    test('should apply rhs-open class when RHS is open', () => {
        jest.mocked(useTeamByName).mockReturnValue(team);
        const stateWithRhsOpen = {
            ...baseState,
            views: {rhs: {isSidebarOpen: true}},
        };

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/channel/test-team/channels/town-square']}>
                <Route path='/_popout/channel/:team/:path(channels|messages)/:identifier/:postid?'>
                    <ChannelPopout/>
                </Route>
            </MemoryRouter>,
            stateWithRhsOpen,
        );

        const mainWrapper = screen.getByTestId('channel-identifier-router').closest('.main-wrapper');
        expect(mainWrapper).toHaveClass('rhs-open');
    });
});

describe('getPopoutChannelTitle', () => {
    test('should return DM title format for DM channels', () => {
        const result = getPopoutChannelTitle('D');
        expect(result).toEqual({
            id: 'channel_popout.title.dm',
            defaultMessage: '{channelName} - {serverName}',
        });
    });

    test('should return DM title format for GM channels', () => {
        const result = getPopoutChannelTitle('G');
        expect(result).toEqual({
            id: 'channel_popout.title.dm',
            defaultMessage: '{channelName} - {serverName}',
        });
    });

    test('should return standard title format for regular channels', () => {
        const result = getPopoutChannelTitle('O');
        expect(result).toEqual({
            id: 'channel_popout.title',
            defaultMessage: '{channelName} - {teamName} - {serverName}',
        });
    });

    test('should return standard title format when type is undefined', () => {
        const result = getPopoutChannelTitle(undefined);
        expect(result).toEqual({
            id: 'channel_popout.title',
            defaultMessage: '{channelName} - {teamName} - {serverName}',
        });
    });
});
