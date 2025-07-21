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
    lookupInteractiveDialog: jest.fn(() => {
        return {type: 'MOCK_LOOKUP_DIALOG', data: {items: []}};
    }),
    getIncomingHooks: jest.fn(() => {
        return {type: 'MOCK_GET_INCOMING_HOOKS', data: []};
    }),
    getOutgoingHooks: jest.fn(() => {
        return {type: 'MOCK_GET_OUTGOING_HOOKS', data: []};
    }),
    getCustomTeamCommands: jest.fn(() => {
        return {type: 'MOCK_GET_COMMANDS', data: []};
    }),
    getOAuthApps: jest.fn(() => {
        return {type: 'MOCK_GET_OAUTH_APPS', data: []};
    }),
    getOutgoingOAuthConnections: jest.fn(() => {
        return {type: 'MOCK_GET_OUTGOING_OAUTH_CONNECTIONS', data: []};
    }),
    getAppsOAuthAppIDs: jest.fn(() => {
        return {type: 'MOCK_GET_APPS_OAUTH_APP_IDS'};
    }),
    isIncomingWebhooksWithCount: jest.fn(() => false),
}));

jest.mock('mattermost-redux/selectors/entities/apps', () => ({
    appsEnabled: jest.fn(() => true),
}));

jest.mock('mattermost-redux/selectors/entities/integrations', () => ({
    getDialogArguments: jest.fn(() => null),
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

    describe('lookupInteractiveDialog', () => {
        const {getDialogArguments} = require('mattermost-redux/selectors/entities/integrations');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('lookupInteractiveDialog with current channel', async () => {
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
            getDialogArguments.mockReturnValue({channel_id: 'dialog_channel_id'});

            const submission = {
                callback_id: 'callback_id',
                state: 'state',
                submission: {
                    query: 'search term',
                    selected_field: 'dynamic_field',
                },
                user_id: 'current_user_id',
                team_id: 'team_id1',
                channel_id: '',
                cancelled: false,
                url: 'https://example.com/lookup',
            };

            const expectedSubmission = {
                ...submission,
                channel_id: 'dialog_channel_id',
            };

            await testStore.dispatch(Actions.lookupInteractiveDialog(submission));

            expect(IntegrationActions.lookupInteractiveDialog).toHaveBeenCalledWith(expectedSubmission);
        });

        test('lookupInteractiveDialog without dialog arguments', async () => {
            const testStore = mockStore(initialState);
            getDialogArguments.mockReturnValue(null);

            const submission = {
                callback_id: 'callback_id',
                state: 'state',
                submission: {
                    query: 'search term',
                },
                user_id: 'current_user_id',
                team_id: 'team_id1',
                channel_id: 'current_channel_id',
                cancelled: false,
                url: 'https://example.com/lookup',
            };

            await testStore.dispatch(Actions.lookupInteractiveDialog(submission));

            expect(IntegrationActions.lookupInteractiveDialog).toHaveBeenCalledWith(submission);
        });

        test('lookupInteractiveDialog with error response', async () => {
            const testStore = mockStore(initialState);
            const error = {message: 'Lookup failed', status_code: 400};
            IntegrationActions.lookupInteractiveDialog.mockReturnValue({
                type: 'MOCK_LOOKUP_DIALOG_ERROR',
                data: null,
                error,
            });

            const submission = {
                callback_id: 'callback_id',
                state: 'state',
                submission: {query: 'test'},
                user_id: 'current_user_id',
                team_id: 'team_id1',
                channel_id: 'current_channel_id',
                cancelled: false,
                url: 'https://example.com/lookup',
            };

            const result = await testStore.dispatch(Actions.lookupInteractiveDialog(submission));
            expect(result.error).toBe(error);
        });
    });

    describe('loadIncomingHooksAndProfilesForTeam', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load hooks and profiles', async () => {
            const mockHooks = [
                {id: 'hook1', user_id: 'user1'},
                {id: 'hook2', user_id: 'user2'},
            ];
            IntegrationActions.getIncomingHooks.mockReturnValue({
                type: 'MOCK_GET_INCOMING_HOOKS',
                data: mockHooks,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadIncomingHooksAndProfilesForTeam('team_id1', 0, 50, false));

            expect(IntegrationActions.getIncomingHooks).toHaveBeenCalledWith('team_id1', 0, 50, false);
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1', 'user2']);
        });

        test('should handle webhooks with count response', async () => {
            const mockHooks = [
                {id: 'hook1', user_id: 'user1'},
                {id: 'hook2', user_id: 'user2'},
            ];
            const mockResponse = {
                incoming_webhooks: mockHooks,
                total_count: 2,
            };
            IntegrationActions.getIncomingHooks.mockReturnValue({
                type: 'MOCK_GET_INCOMING_HOOKS',
                data: mockResponse,
            });
            IntegrationActions.isIncomingWebhooksWithCount.mockReturnValue(true);

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadIncomingHooksAndProfilesForTeam('team_id1', 0, 50, true));

            expect(IntegrationActions.getIncomingHooks).toHaveBeenCalledWith('team_id1', 0, 50, true);
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1', 'user2']);
        });

        test('should handle empty hooks response', async () => {
            IntegrationActions.getIncomingHooks.mockReturnValue({
                type: 'MOCK_GET_INCOMING_HOOKS',
                data: null,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadIncomingHooksAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getIncomingHooks).toHaveBeenCalledWith('team_id1', 0, 100, false);
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadOutgoingHooksAndProfilesForTeam', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load outgoing hooks and profiles', async () => {
            const mockHooks = [
                {id: 'hook1', creator_id: 'user1'},
                {id: 'hook2', creator_id: 'user2'},
            ];
            IntegrationActions.getOutgoingHooks.mockReturnValue({
                type: 'MOCK_GET_OUTGOING_HOOKS',
                data: mockHooks,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingHooksAndProfilesForTeam('team_id1', 1, 25));

            expect(IntegrationActions.getOutgoingHooks).toHaveBeenCalledWith('', 'team_id1', 1, 25);
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1', 'user2']);
        });

        test('should handle empty outgoing hooks response', async () => {
            IntegrationActions.getOutgoingHooks.mockReturnValue({
                type: 'MOCK_GET_OUTGOING_HOOKS',
                data: null,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingHooksAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getOutgoingHooks).toHaveBeenCalledWith('', 'team_id1', 0, 100);
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadCommandsAndProfilesForTeam', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load commands and profiles', async () => {
            const mockCommands = [
                {id: 'cmd1', creator_id: 'user1'},
                {id: 'cmd2', creator_id: 'user2'},
            ];
            IntegrationActions.getCustomTeamCommands.mockReturnValue({
                type: 'MOCK_GET_COMMANDS',
                data: mockCommands,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadCommandsAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getCustomTeamCommands).toHaveBeenCalledWith('team_id1');
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1', 'user2']);
        });

        test('should handle empty commands response', async () => {
            IntegrationActions.getCustomTeamCommands.mockReturnValue({
                type: 'MOCK_GET_COMMANDS',
                data: null,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadCommandsAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getCustomTeamCommands).toHaveBeenCalledWith('team_id1');
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadOAuthAppsAndProfiles', () => {
        const {appsEnabled} = require('mattermost-redux/selectors/entities/apps');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load OAuth apps and profiles with apps enabled', async () => {
            appsEnabled.mockReturnValue(true);
            const mockApps = [
                {id: 'app1', creator_id: 'user1'},
                {id: 'app2', creator_id: 'user2'},
            ];
            IntegrationActions.getOAuthApps.mockReturnValue({
                type: 'MOCK_GET_OAUTH_APPS',
                data: mockApps,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOAuthAppsAndProfiles(2, 30));

            expect(IntegrationActions.getAppsOAuthAppIDs).toHaveBeenCalled();
            expect(IntegrationActions.getOAuthApps).toHaveBeenCalledWith(2, 30);
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1', 'user2']);
        });

        test('should load OAuth apps and profiles with apps disabled', async () => {
            appsEnabled.mockReturnValue(false);
            const mockApps = [
                {id: 'app1', creator_id: 'user1'},
            ];
            IntegrationActions.getOAuthApps.mockReturnValue({
                type: 'MOCK_GET_OAUTH_APPS',
                data: mockApps,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOAuthAppsAndProfiles());

            expect(IntegrationActions.getAppsOAuthAppIDs).not.toHaveBeenCalled();
            expect(IntegrationActions.getOAuthApps).toHaveBeenCalledWith(0, 100);
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1']);
        });

        test('should handle empty OAuth apps response', async () => {
            appsEnabled.mockReturnValue(true);
            IntegrationActions.getOAuthApps.mockReturnValue({
                type: 'MOCK_GET_OAUTH_APPS',
                data: null,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOAuthAppsAndProfiles());

            expect(IntegrationActions.getAppsOAuthAppIDs).toHaveBeenCalled();
            expect(IntegrationActions.getOAuthApps).toHaveBeenCalledWith(0, 100);
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadOutgoingOAuthConnectionsAndProfiles', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load outgoing OAuth connections and profiles', async () => {
            const mockConnections = [
                {id: 'conn1', creator_id: 'user1'},
                {id: 'conn2', creator_id: 'user2'},
            ];
            IntegrationActions.getOutgoingOAuthConnections.mockReturnValue({
                type: 'MOCK_GET_OUTGOING_OAUTH_CONNECTIONS',
                data: mockConnections,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingOAuthConnectionsAndProfiles('team_id1', 1, 50));

            expect(IntegrationActions.getOutgoingOAuthConnections).toHaveBeenCalledWith('team_id1', 1, 50);
            expect(getProfilesByIds).toHaveBeenCalledWith(['user1', 'user2']);
        });

        test('should handle empty connections response', async () => {
            IntegrationActions.getOutgoingOAuthConnections.mockReturnValue({
                type: 'MOCK_GET_OUTGOING_OAUTH_CONNECTIONS',
                data: null,
            });

            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingOAuthConnectionsAndProfiles('team_id1'));

            expect(IntegrationActions.getOutgoingOAuthConnections).toHaveBeenCalledWith('team_id1', 0, 100);
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });

    describe('loadProfilesForOutgoingOAuthConnections', () => {
        test('load profiles for connections including user we already have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingOAuthConnections([{creator_id: 'current_user_id'}, {creator_id: 'user_id2'}] as any[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id2']));
        });

        test('load profiles for connections including only users we don\'t have', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingOAuthConnections([{creator_id: 'user_id1'}, {creator_id: 'user_id2'}] as any[]));
            expect(getProfilesByIds).toHaveBeenCalledWith((expect as GreatExpectations).arrayContainingExactly(['user_id1', 'user_id2']));
        });

        test('load profiles for empty connections', () => {
            const testStore = mockStore(initialState);
            testStore.dispatch(Actions.loadProfilesForOutgoingOAuthConnections([]));
            expect(getProfilesByIds).not.toHaveBeenCalled();
        });
    });
});
