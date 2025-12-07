// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {joinTeam} from 'components/team_controller/actions';

import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

jest.mock('mattermost-redux/actions/teams', () => ({
    getTeamByName: jest.fn(),
}));

jest.mock('actions/team_actions', () => ({
    addUserToTeam: jest.fn(),
}));

const teamsActions = require('mattermost-redux/actions/teams');
const teamActions = require('actions/team_actions');

describe('components/team_controller/actions', () => {
    const testUserId = 'test_user_id';
    const testUser = TestHelper.getUserMock({id: testUserId});
    const testTeamId = 'test_team_id';
    const testTeam = TestHelper.getTeamMock({id: testTeamId});
    const initialState = {
        entities: {
            users: {
                profiles: {
                    [testUserId]: testUser,
                },
                currentUserId: testUserId,
            },
            general: {
                license: {},
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    describe('joinTeam', () => {
        test('should not allow joining a deleted team', async () => {
            const getTeamByNameFn = () => () => Promise.resolve({data: {...testTeam, delete_at: 154545}});
            teamsActions.getTeamByName.mockImplementation(getTeamByNameFn);

            const testStore = mockStore(initialState);
            const result = await testStore.dispatch(joinTeam(testTeam.name, false));

            expect(result).toEqual({error: Error('Team not found or deleted')});
        });

        test('should not allow joining a team when user cannot be added to it', async () => {
            const getTeamByNameFn = () => () => Promise.resolve({data: testTeam});
            teamsActions.getTeamByName.mockImplementation(getTeamByNameFn);

            const addUserToTeamFn = () => () => Promise.resolve({error: {message: 'cannot add user to team'}});
            teamActions.addUserToTeam.mockImplementation(addUserToTeamFn);

            const testStore = mockStore(initialState);
            const result = await testStore.dispatch(joinTeam(testTeam.name, false));

            expect(result).toEqual({error: {message: 'cannot add user to team'}});
        });
    });
});
