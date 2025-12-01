// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as teamsActions from 'mattermost-redux/actions/teams';

import * as teamActions from 'actions/team_actions';

import {joinTeam} from 'components/team_controller/actions';

import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

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
            vi.spyOn(teamsActions, 'getTeamByName').mockImplementation(getTeamByNameFn as any);

            const testStore = mockStore(initialState);
            const result = await testStore.dispatch(joinTeam(testTeam.name, false));

            expect(result).toEqual({error: Error('Team not found or deleted')});
        });

        test('should not allow joining a team when user cannot be added to it', async () => {
            const getTeamByNameFn = () => () => Promise.resolve({data: testTeam});
            vi.spyOn(teamsActions, 'getTeamByName').mockImplementation(getTeamByNameFn as any);

            const addUserToTeamFn = () => () => Promise.resolve({error: {message: 'cannot add user to team'}});
            vi.spyOn(teamActions, 'addUserToTeam').mockImplementation(addUserToTeamFn as any);

            const testStore = mockStore(initialState);
            const result = await testStore.dispatch(joinTeam(testTeam.name, false));

            expect(result).toEqual({error: {message: 'cannot add user to team'}});
        });
    });
});
