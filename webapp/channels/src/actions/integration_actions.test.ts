// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IncomingWebhook, OutgoingWebhook, Command, OAuthApp} from '@mattermost/types/integrations';

import * as IntegrationActions from 'mattermost-redux/actions/integrations';
import {getProfilesByIds} from 'mattermost-redux/actions/users';

import * as Actions from 'actions/integration_actions';

import mockStore from 'tests/test_store';

jest.mock('mattermost-redux/actions/users', () => ({
    getProfilesByIds: jest.fn(() => {
        return {type: ''};
    }),
}));

jest.mock('mattermost-redux/actions/integrations', () => ({
    submitInteractiveDialog: jest.fn(() => {
        return {type: 'MOCK_SUBMIT_DIALOG', data: {errors: {}}};
    }),
}));

interface CustomMatchers<R = unknown> {
    arrayContainingExactly(stringArray: string[]): R;
}

type GreatExpectations = typeof expect & CustomMatchers;

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
            channels: {
                currentChannelId: 'current_channel_id',
            },
            integrations: {},
        },
    };

    describe('loadProfilesForIncomingHooks', () => {
        test('load profiles for hooks including user we already have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForIncomingHooks([{user_id: 'current_user_id'}, {user_id: 'user_id2'}] as IncomingWebhook[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id2']));
        });

        test('load profiles for hooks including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForIncomingHooks([{user_id: 'user_id1'}, {user_id: 'user_id2'}] as IncomingWebhook[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id1', 'user_id2']));
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
            testStore.dispatch(Actions.loadProfilesForOutgoingHooks([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}] as OutgoingWebhook[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id2']));
        });

        test('load profiles for hooks including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingHooks([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}] as OutgoingWebhook[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id1', 'user_id2']));
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
            testStore.dispatch(Actions.loadProfilesForCommands([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}] as Command[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id2']));
        });

        test('load profiles for commands including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForCommands([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}] as Command[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id1', 'user_id2']));
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
            testStore.dispatch(Actions.loadProfilesForOAuthApps([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}] as OAuthApp[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id2']));
        });

        test('load profiles for apps including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOAuthApps([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}] as OAuthApp[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id1', 'user_id2']));
        });

        test('load profiles for empty apps', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOAuthApps([]));
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('submitInteractiveDialog', () => {
        test('submitInteractiveDialog with current channel', async () => {
            const testState = {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    integrations: {
                        ...initialState.entities.integrations,
                        dialogArguments: {
                            channel_id: 'dialog_channel_id',
                        },
                    },
                },
            };
            const testStore = mockStore(testState);
            const submission = {
                callback_id: 'callback_id',
                state: 'state',
                submission: {
                    name: 'value',
                },
                user_id: 'current_user_id',
                team_id: 'team_id1',
                channel_id: '',
                cancelled: false,
            };

            const expectedSubmission = {
                ...submission,
                channel_id: 'dialog_channel_id',
            };

            await testStore.dispatch(Actions.submitInteractiveDialog(submission));

            expect(IntegrationActions.submitInteractiveDialog).toHaveBeenCalledWith(expectedSubmission);
        });

        test('submitInteractiveDialog with currentChannel context', async () => {
            const testStore = mockStore(initialState);

            const submission = {
                callback_id: 'callback_id',
                state: 'state',
                submission: {
                    name: 'value',
                },
                user_id: 'current_user_id',
                team_id: 'team_id1',
                channel_id: 'current_channel_id',
                cancelled: false,
            };

            await testStore.dispatch(Actions.submitInteractiveDialog(submission));

            expect(IntegrationActions.submitInteractiveDialog).toHaveBeenCalledWith(submission);
        });
    });
});
