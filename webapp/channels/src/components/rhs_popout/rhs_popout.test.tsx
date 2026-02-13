// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as ReactRedux from 'react-redux';
import {MemoryRouter, Route} from 'react-router-dom';

import {fetchChannelsAndMembers, getChannelMembers, selectChannel} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';

import {useTeamByName} from 'components/common/hooks/use_team';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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
    selectChannel: jest.fn(),
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    selectTeam: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getChannelByName: jest.fn(),
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

const mockDispatch = jest.fn();
const mockUseDispatch = ReactRedux.useDispatch as jest.MockedFunction<typeof ReactRedux.useDispatch>;
const mockUseSelector = ReactRedux.useSelector as jest.MockedFunction<typeof ReactRedux.useSelector>;
const mockUseParams = jest.spyOn(require('react-router-dom'), 'useParams');
const mockSelectChannel = selectChannel as jest.MockedFunction<typeof selectChannel>;
const mockGetChannelMembers = getChannelMembers as jest.MockedFunction<typeof getChannelMembers>;
const mockSelectTeam = selectTeam as jest.MockedFunction<typeof selectTeam>;
const mockFetchChannelsAndMembers = fetchChannelsAndMembers as jest.MockedFunction<typeof fetchChannelsAndMembers>;
const mockUseTeamByName = useTeamByName as jest.MockedFunction<typeof useTeamByName>;

describe('RhsPopout', () => {
    const team1 = TestHelper.getTeamMock({id: 'team1', name: 'team1'});
    const channel1 = TestHelper.getChannelMock({id: 'channel1', name: 'channel1'});

    beforeEach(() => {
        mockDispatch.mockReturnValue({type: 'MOCK_ACTION'});
        mockUseDispatch.mockReturnValue(mockDispatch);
        mockUseParams.mockReturnValue({team: 'team1', identifier: 'channel1'});
        mockUseTeamByName.mockReturnValue(team1);
        mockUseSelector.mockReturnValue(channel1);

        mockSelectChannel.mockImplementation((channelId: string) => ({
            type: 'SELECT_CHANNEL',
            data: channelId,
        }));
        mockGetChannelMembers.mockImplementation(() => jest.fn(() => Promise.resolve({data: []})));
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
});

