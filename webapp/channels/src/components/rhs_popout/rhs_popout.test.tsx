// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import {fetchChannelsAndMembers, getChannelMembers, selectChannel} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';

import {useTeamByName} from 'components/common/hooks/use_team';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import RhsPopout from './rhs_popout';

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchChannelsAndMembers: jest.fn(() => ({type: 'MOCK'})),
    getChannelMembers: jest.fn(() => ({type: 'MOCK'})),
    selectChannel: jest.fn(() => ({type: 'MOCK'})),
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    selectTeam: jest.fn(() => ({type: 'MOCK'})),
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

jest.mock('components/rhs_search_popout', () => ({
    __esModule: true,
    default: () => <div data-testid='rhs-search-popout'>{'RHS Search Popout'}</div>,
}));

describe('RhsPopout', () => {
    const team1 = TestHelper.getTeamMock({id: 'team1', name: 'team1'});
    const channel1 = TestHelper.getChannelMock({id: 'channel1', name: 'channel1'});

    const baseState = {
        entities: {
            channels: {
                channels: {[channel1.id]: channel1},
                myMembers: {},
            },
            teams: {
                currentTeamId: team1.id,
                teams: {[team1.id]: team1},
            },
        },
    };

    beforeEach(() => {
        jest.mocked(useTeamByName).mockReturnValue(team1);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    function renderPopout(path: string, state = baseState) {
        return renderWithContext(
            <MemoryRouter initialEntries={[path]}>
                <Route
                    path='/_popout/rhs/:team'
                    component={RhsPopout}
                />
            </MemoryRouter>,
            state,
        );
    }

    it('should dispatch selectTeam and fetchChannelsAndMembers when team is available', async () => {
        renderPopout('/_popout/rhs/team1/search?q=test');

        await waitFor(() => {
            expect(jest.mocked(selectTeam)).toHaveBeenCalledWith(team1.id);
            expect(jest.mocked(fetchChannelsAndMembers)).toHaveBeenCalledWith(team1.id);
        });
    });

    it('should dispatch selectChannel and getChannelMembers when channel is in query params', async () => {
        renderPopout('/_popout/rhs/team1/search?channel=channel1');

        await waitFor(() => {
            expect(jest.mocked(selectChannel)).toHaveBeenCalledWith(channel1.id);
            expect(jest.mocked(getChannelMembers)).toHaveBeenCalledWith(channel1.id);
        });
    });

    it('should render the correct structure', () => {
        const {container} = renderPopout('/_popout/rhs/team1/search?q=test');

        expect(container.querySelector('[data-testid="unreads-status-handler"]')).toBeInTheDocument();
        expect(container.querySelector('.main-wrapper.rhs-popout')).toBeInTheDocument();
        expect(container.querySelector('.sidebar--right')).toBeInTheDocument();
        expect(container.querySelector('.sidebar-right__body')).toBeInTheDocument();
    });

    it('should render RhsSearchPopout for search route', () => {
        renderPopout('/_popout/rhs/team1/search?q=test');
        expect(screen.getByTestId('rhs-search-popout')).toBeInTheDocument();
    });

    it('should render RhsPluginPopout for plugin route', () => {
        renderPopout('/_popout/rhs/team1/plugin/test-plugin');
        expect(screen.getByTestId('rhs-plugin-popout')).toBeInTheDocument();
    });

    it('should not dispatch channel actions when no channel in query params', async () => {
        renderPopout('/_popout/rhs/team1/search?q=test');

        await waitFor(() => {
            expect(jest.mocked(selectTeam)).toHaveBeenCalledWith(team1.id);
        });

        expect(jest.mocked(selectChannel)).not.toHaveBeenCalled();
        expect(jest.mocked(getChannelMembers)).not.toHaveBeenCalled();
    });
});
