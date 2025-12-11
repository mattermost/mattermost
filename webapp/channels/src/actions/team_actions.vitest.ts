// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as channelActions from 'mattermost-redux/actions/channels';
import * as TeamActions from 'mattermost-redux/actions/teams';
import * as userActions from 'mattermost-redux/actions/users';

import * as Actions from 'actions/team_actions';

import configureStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

vi.mock('mattermost-redux/actions/teams', async (importOriginal) => {
    const actual = await importOriginal<typeof import('mattermost-redux/actions/teams')>();
    return {
        ...actual,
        addUsersToTeamGracefully: vi.fn(() => {
            return {
                type: 'ADD_USER',
            };
        }),
        removeUserFromTeam: vi.fn(() => {
            return {
                type: 'REMOVE_USER_FROM_TEAM',
            };
        }),
        getTeamStats: vi.fn(() => {
            return {
                type: 'GET_TEAM_STATS',
            };
        }),
        addUserToTeam: vi.fn(() => {
            return {
                type: 'ADD_USERS_TO_TEAM',
                data: {
                    team_id: 'teamId',
                },
            };
        }),
        getTeam: vi.fn(() => {
            return {
                type: 'GET_TEAM',
            };
        }),
    };
});

vi.mock('mattermost-redux/actions/channels', () => ({
    viewChannel: vi.fn(() => {
        return {
            type: 'VIEW_CHANNEL',
        };
    }),
    getChannelStats: vi.fn(() => {
        return {
            type: 'GET_CHANNEL_STAT',
        };
    }),
}));

vi.mock('mattermost-redux/actions/users', () => ({
    getUser: vi.fn(() => {
        return {
            type: 'GET_USER',
        };
    }),
}));

describe('Actions.Team', () => {
    const currentChannelId = 'currentChannelId';

    const initialState = {
        entities: {
            channels: {
                currentChannelId,
                manuallyUnread: {},
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('switchTeam', () => {
        test('should switch to a team by its URL if no team is provided', () => {
            const testStore = configureStore(initialState);

            testStore.dispatch(Actions.switchTeam('/test'));

            expect(getHistory().push).toHaveBeenCalledWith('/test');
            expect(testStore.getActions()).toEqual([]);
        });

        test('should select a team without changing URL if a team is provided', () => {
            const testStore = configureStore(initialState);

            const team = TestHelper.getTeamMock();

            testStore.dispatch(Actions.switchTeam('/test', team));

            expect(getHistory().push).not.toHaveBeenCalled();
            expect(testStore.getActions()).toContainEqual(TeamActions.selectTeam(team));
        });
    });

    test('addUsersToTeam', () => {
        const testStore = configureStore(initialState);

        testStore.dispatch(Actions.addUsersToTeam('teamId', ['123', '1234']));
        expect(TeamActions.addUsersToTeamGracefully).toHaveBeenCalledWith('teamId', ['123', '1234']);
    });

    test('removeUserFromTeamAndGetStats', async () => {
        const testStore = configureStore(initialState);

        await testStore.dispatch(Actions.removeUserFromTeamAndGetStats('teamId', '123'));
        expect(userActions.getUser).toHaveBeenCalledWith('123');
        expect(TeamActions.getTeamStats).toHaveBeenCalledWith('teamId');
        expect(channelActions.getChannelStats).toHaveBeenCalledWith(currentChannelId);
    });

    test('addUserToTeam', async () => {
        const testStore = configureStore(initialState);

        await testStore.dispatch(Actions.addUserToTeam('teamId', 'userId'));
        expect(TeamActions.addUserToTeam).toHaveBeenCalledWith('teamId', 'userId');
        expect(TeamActions.getTeam).toHaveBeenCalledWith('teamId');
    });
});
