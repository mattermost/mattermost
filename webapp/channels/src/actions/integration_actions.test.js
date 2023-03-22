// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getProfilesByIds} from 'mattermost-redux/actions/users';

import mockStore from 'tests/test_store';

import * as Actions from 'actions/integration_actions.jsx';

jest.mock('mattermost-redux/actions/users', () => ({
    getProfilesByIds: jest.fn(() => {
        return {type: ''};
    }),
}));

describe('actions/integration_actions', () => {
    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {current_user_id: {id: 'current_user_id', username: 'current_user'}, user_id3: {id: 'user_id3', username: 'user3'}, user_id4: {id: 'user_id4', username: 'user4'}},
            },
        },
    };

    describe('loadProfilesForIncomingHooks', () => {
        test('load profiles for hooks including user we already have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForIncomingHooks([{user_id: 'current_user_id'}, {user_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id2']));
        });

        test('load profiles for hooks including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForIncomingHooks([{user_id: 'user_id1'}, {user_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id1', 'user_id2']));
        });

        test('load profiles for empty hooks', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForIncomingHooks([]));
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadProfilesForOutgoingHooks', () => {
        test('load profiles for hooks including user we already have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingHooks([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id2']));
        });

        test('load profiles for hooks including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingHooks([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id1', 'user_id2']));
        });

        test('load profiles for empty hooks', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingHooks([]));
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadProfilesForCommands', () => {
        test('load profiles for commands including user we already have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForCommands([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id2']));
        });

        test('load profiles for commands including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForCommands([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id1', 'user_id2']));
        });

        test('load profiles for empty commands', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForCommands([]));
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadProfilesForOAuthApps', () => {
        test('load profiles for apps including user we already have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOAuthApps([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id2']));
        });

        test('load profiles for apps including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOAuthApps([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}]));
            expect(getProfilesByIds).toHaveBeenCalledWith(expect.arrayContainingExactly(['user_id1', 'user_id2']));
        });

        test('load profiles for empty apps', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOAuthApps([]));
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });
});
