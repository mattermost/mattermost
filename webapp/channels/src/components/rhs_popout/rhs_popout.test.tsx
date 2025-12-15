// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as ReactRedux from 'react-redux';
import {MemoryRouter, Route} from 'react-router-dom';

import {fetchChannelsAndMembers, getChannelMembers, getChannelStats, selectChannel} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getChannelByName, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {useTeamByName} from 'components/common/hooks/use_team';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import RhsPopout from './rhs_popout';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn(),
    useSelector: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchChannelsAndMembers: jest.fn(),
    getChannelMembers: jest.fn(),
    getChannelStats: jest.fn(),
    selectChannel: jest.fn(),
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    selectTeam: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getChannelByName: jest.fn(() => null),
}));

jest.mock('components/common/hooks/use_team', () => ({
    useTeamByName: jest.fn(),
}));

jest.mock('components/unreads_status_handler', () => ({
    __esModule: true,
    default: () => <div data-testid='unreads-status-handler'>{'UnreadsStatusHandler'}</div>,
}));

jest.mock('components/rhs_plugin_popout', () => ({
    __esModule: true,
    default: () => <div data-testid='rhs-plugin-popout'>{'RHS Plugin Popout'}</div>,
}));

jest.mock('components/channel_info_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-info-rhs'>{'Channel Info RHS'}</div>,
}));

jest.mock('components/channel_members_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-members-rhs'>{'Channel Members RHS'}</div>,
}));

const mockDispatch = jest.fn();
const mockUseDispatch = ReactRedux.useDispatch as jest.MockedFunction<typeof ReactRedux.useDispatch>;
const mockUseSelector = ReactRedux.useSelector as jest.MockedFunction<typeof ReactRedux.useSelector>;
const mockUseParams = jest.spyOn(require('react-router-dom'), 'useParams');
const mockSelectChannel = selectChannel as jest.MockedFunction<typeof selectChannel>;
const mockGetChannelMembers = getChannelMembers as jest.MockedFunction<typeof getChannelMembers>;
const mockGetChannelStats = getChannelStats as jest.MockedFunction<typeof getChannelStats>;
const mockSelectTeam = selectTeam as jest.MockedFunction<typeof selectTeam>;
const mockFetchChannelsAndMembers = fetchChannelsAndMembers as jest.MockedFunction<typeof fetchChannelsAndMembers>;
const mockUseTeamByName = useTeamByName as jest.MockedFunction<typeof useTeamByName>;
const mockGetChannelByName = getChannelByName as jest.MockedFunction<typeof getChannelByName>;

describe('RhsPopout', () => {
    const team1 = TestHelper.getTeamMock({id: 'team1', name: 'team1'});
    const channel1 = TestHelper.getChannelMock({id: 'channel1', name: 'channel1'});

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockReturnValue({type: 'MOCK_ACTION'});
        mockUseDispatch.mockReturnValue(mockDispatch);
        mockUseParams.mockReturnValue({team: 'team1', identifier: 'channel1'});
        mockUseTeamByName.mockReturnValue(team1);
        mockGetChannelByName.mockImplementation(() => channel1);
        mockUseSelector.mockImplementation((selector: unknown) => {
            if (typeof selector === 'function') {
                if (selector === getCurrentChannel) {
                    return channel1;
                }
                if (selector === getCurrentTeam) {
                    return team1;
                }
                if (selector.toString().includes('getChannelByName')) {
                    return channel1;
                }
                const mockState = {} as GlobalState;
                try {
                    return selector(mockState);
                } catch {
                    return channel1;
                }
            }
            return channel1;
        });

        mockSelectChannel.mockImplementation((channelId: string) => ({
            type: 'SELECT_CHANNEL',
            data: channelId,
        }));
        mockGetChannelMembers.mockImplementation(() => jest.fn(() => Promise.resolve({data: []})));
        mockGetChannelStats.mockImplementation(() => jest.fn(() => Promise.resolve({data: {channel_id: 'channel1', member_count: 0, guest_count: 0, pinnedpost_count: 0, files_count: 0}})));
        mockSelectTeam.mockImplementation((team: string | typeof team1) => {
            const teamId = typeof team === 'string' ? team : team.id;
            return {
                type: 'SELECT_TEAM',
                data: teamId,
            };
        });
        mockFetchChannelsAndMembers.mockImplementation(() => jest.fn(() => Promise.resolve({data: {channels: [], channelMembers: []}})));
    });

    it('should dispatch correct actions when channelId and teamId are available', async () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1']}>
                <Route
                    path='/_popout/rhs/:team/:identifier'
                    component={RhsPopout}
                />
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(mockSelectChannel).toHaveBeenCalledWith(channel1.id);
            expect(mockGetChannelMembers).toHaveBeenCalledWith(channel1.id);
            expect(mockSelectTeam).toHaveBeenCalledWith(team1.id);
            expect(mockFetchChannelsAndMembers).toHaveBeenCalledWith(team1.id);
        });
    });

    it('should render the correct structure', () => {
        const {container} = renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1']}>
                <Route
                    path='/_popout/rhs/:team/:identifier'
                    component={RhsPopout}
                />
            </MemoryRouter>,
        );

        expect(container.querySelector('[data-testid="unreads-status-handler"]')).toBeInTheDocument();
        expect(container.querySelector('.main-wrapper.rhs-popout')).toBeInTheDocument();
        expect(container.querySelector('.sidebar--right')).toBeInTheDocument();
        expect(container.querySelector('.sidebar-right__body')).toBeInTheDocument();
    });

    it('should render RhsPluginPopout for plugin route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/test-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier'
                    component={RhsPopout}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('rhs-plugin-popout')).toBeInTheDocument();
    });

    it('should render ChannelInfoRhs for channel-info route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/channel-info']}>
                <Route
                    path='/_popout/rhs/:team/:identifier'
                    component={RhsPopout}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('channel-info-rhs')).toBeInTheDocument();
    });

    it('should render ChannelMembersRhs for channel-members route', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/channel-members']}>
                <Route
                    path='/_popout/rhs/:team/:identifier'
                    component={RhsPopout}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('channel-members-rhs')).toBeInTheDocument();
    });
});

