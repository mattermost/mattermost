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
            const {getDialogArguments} = require('mattermost-redux/selectors/entities/integrations');
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
            const {getDialogArguments} = require('mattermost-redux/selectors/entities/integrations');
            getDialogArguments.mockReturnValue(null);
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

        test('submitInteractiveDialog populates user_id and team_id from Redux state', async () => {
            const testStore = mockStore(initialState);

            // Components pass empty strings, action should populate from Redux state
            const submission = {
                callback_id: 'callback_id',
                state: 'state',
                submission: {
                    name: 'value',
                },
                user_id: '', // Empty - should be populated by action
                team_id: '', // Empty - should be populated by action
                channel_id: 'current_channel_id',
                cancelled: false,
            };

            const expectedSubmission = {
                ...submission,
                user_id: 'current_user_id', // Should be populated from getCurrentUserId
                team_id: 'team_id1', // Should be populated from getCurrentTeamId
            };

            await testStore.dispatch(Actions.submitInteractiveDialog(submission));

            expect(IntegrationActions.submitInteractiveDialog).toHaveBeenCalledWith(expectedSubmission);
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

        test('lookupInteractiveDialog with current channel', async () => {
            const testStore = mockStore(initialState);
            const {getDialogArguments} = require('mattermost-redux/selectors/entities/integrations');
            getDialogArguments.mockReturnValue(null);

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

            await testStore.dispatch(Actions.lookupInteractiveDialog(submission));
            expect(IntegrationActions.lookupInteractiveDialog).toHaveBeenCalledWith(submission);
        });
    });

    describe('loadIncomingHooksAndProfilesForTeam', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load hooks and profiles', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadIncomingHooksAndProfilesForTeam('team_id1', 0, 50, false));

            expect(IntegrationActions.getIncomingHooks).toHaveBeenCalledWith('team_id1', 0, 50, false);
        });

        test('should handle webhooks with count response', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadIncomingHooksAndProfilesForTeam('team_id1', 0, 50, true));

            expect(IntegrationActions.getIncomingHooks).toHaveBeenCalledWith('team_id1', 0, 50, true);
        });

        test('should handle default parameters', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadIncomingHooksAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getIncomingHooks).toHaveBeenCalledWith('team_id1', 0, 100, false);
        });
    });

    describe('loadOutgoingHooksAndProfilesForTeam', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load outgoing hooks and profiles', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingHooksAndProfilesForTeam('team_id1', 1, 25));

            expect(IntegrationActions.getOutgoingHooks).toHaveBeenCalledWith('', 'team_id1', 1, 25);
        });

        test('should use default parameters', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingHooksAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getOutgoingHooks).toHaveBeenCalledWith('', 'team_id1', 0, 100);
        });
    });

    describe('loadCommandsAndProfilesForTeam', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load commands and profiles', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadCommandsAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getCustomTeamCommands).toHaveBeenCalledWith('team_id1');
        });

        test('should handle team commands', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadCommandsAndProfilesForTeam('team_id1'));

            expect(IntegrationActions.getCustomTeamCommands).toHaveBeenCalledWith('team_id1');
        });
    });

    describe('loadOAuthAppsAndProfiles', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load OAuth apps with custom parameters', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOAuthAppsAndProfiles(2, 30));

            expect(IntegrationActions.getOAuthApps).toHaveBeenCalledWith(2, 30);
        });

        test('should load OAuth apps with default parameters', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOAuthAppsAndProfiles());

            expect(IntegrationActions.getOAuthApps).toHaveBeenCalledWith(0, 100);
        });

        test('should handle OAuth apps loading', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOAuthAppsAndProfiles());

            expect(IntegrationActions.getOAuthApps).toHaveBeenCalledWith(0, 100);
        });
    });

    describe('loadOutgoingOAuthConnectionsAndProfiles', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should load outgoing OAuth connections', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingOAuthConnectionsAndProfiles('team_id1', 1, 50));

            expect(IntegrationActions.getOutgoingOAuthConnections).toHaveBeenCalledWith('team_id1', 1, 50);
        });

        test('should use default connection parameters', async () => {
            const testStore = mockStore(initialState);
            await testStore.dispatch(Actions.loadOutgoingOAuthConnectionsAndProfiles('team_id1'));

            expect(IntegrationActions.getOutgoingOAuthConnections).toHaveBeenCalledWith('team_id1', 0, 100);
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
