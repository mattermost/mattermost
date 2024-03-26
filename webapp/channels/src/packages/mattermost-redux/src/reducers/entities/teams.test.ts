// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TeamTypes, AdminTypes} from 'mattermost-redux/action_types';
import teamsReducer from 'mattermost-redux/reducers/entities/teams';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

type ReducerState = ReturnType<typeof teamsReducer>;

describe('Reducers.teams.myMembers', () => {
    it('initial state', async () => {
        let state = {} as ReducerState;

        state = teamsReducer(state, {type: undefined});
        expect(state.myMembers).toEqual({});
    });

    it('RECEIVED_MY_TEAM_MEMBER', async () => {
        const myMember1 = {user_id: 'user_id_1', team_id: 'team_id_1', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const myMember2 = {user_id: 'user_id_2', team_id: 'team_id_2', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const myMember3 = {user_id: 'user_id_3', team_id: 'team_id_3', delete_at: 1, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};

        let state = {myMembers: {team_id_1: myMember1}} as unknown as ReducerState;
        const testAction = {
            type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
            data: myMember2,
            result: {team_id_1: myMember1, team_id_2: myMember2},
        };

        state = teamsReducer(state, testAction);
        expect(state.myMembers).toEqual(testAction.result);

        testAction.data = myMember3;
        state = teamsReducer(state, {type: undefined});
        expect(state.myMembers).toEqual(testAction.result);
    });

    it('RECEIVED_MY_TEAM_MEMBERS', async () => {
        let state = {} as ReducerState;
        const myMember1 = {user_id: 'user_id_1', team_id: 'team_id_1', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const myMember2 = {user_id: 'user_id_2', team_id: 'team_id_2', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const myMember3 = {user_id: 'user_id_3', team_id: 'team_id_3', delete_at: 1, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const testAction = {
            type: TeamTypes.RECEIVED_MY_TEAM_MEMBERS,
            data: [myMember1, myMember2, myMember3],
            result: {team_id_1: myMember1, team_id_2: myMember2},
        };

        state = teamsReducer(state, testAction);
        expect(state.myMembers).toEqual(testAction.result);

        state = teamsReducer(state, {type: undefined});
        expect(state.myMembers).toEqual(testAction.result);
    });

    it('RECEIVED_TEAMS_LIST', async () => {
        const team1 = {name: 'team-1', id: 'team_id_1', delete_at: 0};
        const team2 = {name: 'team-2', id: 'team_id_2', delete_at: 0};
        const team3 = {name: 'team-3', id: 'team_id_3', delete_at: 0};

        let state = {
            myMembers: {
                team_id_1: {...team1, msg_count: 0, mention_count: 0},
                team_id_2: {...team2, msg_count: 0, mention_count: 0},
            },
        } as unknown as ReducerState;

        const testAction = {
            type: TeamTypes.RECEIVED_TEAMS_LIST,
            data: [team3],
            result: {
                team_id_1: {...team1, msg_count: 0, mention_count: 0},
                team_id_2: {...team2, msg_count: 0, mention_count: 0},
            },
        };

        // do not add a team when it's not on the teams.myMembers list
        state = teamsReducer(state, testAction);
        expect(state.myMembers).toEqual(testAction.result);

        // remove deleted team to teams.myMembers list
        team2.delete_at = 1;
        testAction.data = [team2];
        state = teamsReducer(state, testAction);
        expect(state.myMembers).toEqual({team_id_1: {...team1, msg_count: 0, mention_count: 0}});
    });

    it('RECEIVED_TEAMS', async () => {
        const myMember1 = {user_id: 'user_id_1', team_id: 'team_id_1', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const myMember2 = {user_id: 'user_id_2', team_id: 'team_id_2', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};
        const myMember3 = {user_id: 'user_id_3', team_id: 'team_id_3', delete_at: 0, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0};

        let state = {myMembers: {team_id_1: myMember1, team_id_2: myMember2}} as unknown as ReducerState;

        const testAction = {
            type: TeamTypes.RECEIVED_TEAMS,
            data: {team_id_3: myMember3},
            result: {team_id_1: myMember1, team_id_2: myMember2},
        };

        // do not add a team when it's not on the teams.myMembers list
        state = teamsReducer(state, testAction);
        expect(state.myMembers).toEqual(testAction.result);

        // remove deleted team to teams.myMembers list
        myMember2.delete_at = 1;
        testAction.data = {team_id_2: myMember2} as any;
        state = teamsReducer(state, testAction);
        expect(state.myMembers).toEqual({team_id_1: myMember1});
    });
});
describe('Data Retention Teams', () => {
    it('RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS', async () => {
        const state = deepFreeze({
            currentTeamId: '',
            teams: {
                team1: {
                    id: 'team1',
                },
                team2: {
                    id: 'team2',
                },
                team3: {
                    id: 'team3',
                },
            },
            myMembers: {},
            membersInTeam: {},
            totalCount: 0,
            stats: {},
            groupsAssociatedToTeam: {},
        });

        const nextState = teamsReducer(state, {
            type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS,
            data: {
                teams: [{
                    id: 'team4',
                }],
                total_count: 1,
            },
        });

        expect(nextState).not.toBe(state);
        expect(nextState.teams.team1).toEqual({
            id: 'team1',
        });
        expect(nextState.teams.team2).toEqual({
            id: 'team2',
        });
        expect(nextState.teams.team3).toEqual({
            id: 'team3',
        });
        expect(nextState.teams.team4).toEqual({
            id: 'team4',
        });
    });

    it('REMOVE_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SUCCESS', async () => {
        const state = deepFreeze({
            currentTeamId: '',
            teams: {
                team1: {
                    id: 'team1',
                    policy_id: 'policy1',
                },
                team2: {
                    id: 'team2',
                    policy_id: 'policy1',
                },
                team3: {
                    id: 'team3',
                    policy_id: 'policy1',
                },
            },
            myMembers: {},
            membersInTeam: {},
            totalCount: 0,
            stats: {},
            groupsAssociatedToTeam: {},
        });

        const nextState = teamsReducer(state, {
            type: AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SUCCESS,
            data: {
                teams: ['team1', 'team2'],
            },
        });

        expect(nextState).not.toBe(state);
        expect(nextState.teams.team1).toEqual({
            id: 'team1',
            policy_id: null,
        });
        expect(nextState.teams.team2).toEqual({
            id: 'team2',
            policy_id: null,
        });
        expect(nextState.teams.team3).toEqual({
            id: 'team3',
            policy_id: 'policy1',
        });
    });

    it('RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SEARCH', async () => {
        const state = deepFreeze({
            currentTeamId: '',
            teams: {
                team1: {
                    id: 'team1',
                },
                team2: {
                    id: 'team2',
                },
                team3: {
                    id: 'team3',
                },
            },
            myMembers: {},
            membersInTeam: {},
            totalCount: 0,
            stats: {},
            groupsAssociatedToTeam: {},
        });

        const nextState = teamsReducer(state, {
            type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SEARCH,
            data: [
                {
                    id: 'team1',
                },
                {
                    id: 'team4',
                },
            ],
        });

        expect(nextState).not.toBe(state);
        expect(nextState.teams.team1).toEqual({
            id: 'team1',
        });
        expect(nextState.teams.team2).toEqual({
            id: 'team2',
        });
        expect(nextState.teams.team3).toEqual({
            id: 'team3',
        });
        expect(nextState.teams.team4).toEqual({
            id: 'team4',
        });
    });
});
