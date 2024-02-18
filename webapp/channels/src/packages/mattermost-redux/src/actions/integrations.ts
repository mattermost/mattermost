// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Command, CommandArgs, DialogSubmission, IncomingWebhook, OAuthApp, OutgoingOAuthConnection, OutgoingWebhook, SubmitDialogResponse} from '@mattermost/types/integrations';

import {IntegrationTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import {General} from '../constants';

export function createIncomingHook(hook: IncomingWebhook) {
    return bindClientFunc({
        clientFunc: Client4.createIncomingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOK],
        params: [
            hook,
        ],
    });
}

export function getIncomingHook(hookId: string) {
    return bindClientFunc({
        clientFunc: Client4.getIncomingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOK],
        params: [
            hookId,
        ],
    });
}

export function getIncomingHooks(teamId = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getIncomingWebhooks,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOKS],
        params: [
            teamId,
            page,
            perPage,
        ],
    });
}

export function removeIncomingHook(hookId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.removeIncomingWebhook(hookId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: IntegrationTypes.DELETED_INCOMING_HOOK,
                data: {id: hookId},
            },
        ]));

        return {data: true};
    };
}

export function updateIncomingHook(hook: IncomingWebhook) {
    return bindClientFunc({
        clientFunc: Client4.updateIncomingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOK],
        params: [
            hook,
        ],
    });
}

export function createOutgoingHook(hook: OutgoingWebhook) {
    return bindClientFunc({
        clientFunc: Client4.createOutgoingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hook,
        ],
    });
}

export function getOutgoingHook(hookId: string) {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hookId,
        ],
    });
}

export function getOutgoingHooks(channelId = '', teamId = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingWebhooks,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOKS],
        params: [
            channelId,
            teamId,
            page,
            perPage,
        ],
    });
}

export function removeOutgoingHook(hookId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.removeOutgoingWebhook(hookId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: IntegrationTypes.DELETED_OUTGOING_HOOK,
                data: {id: hookId},
            },
        ]));

        return {data: true};
    };
}

export function updateOutgoingHook(hook: OutgoingWebhook) {
    return bindClientFunc({
        clientFunc: Client4.updateOutgoingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hook,
        ],
    });
}

export function regenOutgoingHookToken(hookId: string) {
    return bindClientFunc({
        clientFunc: Client4.regenOutgoingHookToken,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hookId,
        ],
    });
}

export function getCommands(teamId: string) {
    return bindClientFunc({
        clientFunc: Client4.getCommandsList,
        onSuccess: [IntegrationTypes.RECEIVED_COMMANDS],
        params: [
            teamId,
        ],
    });
}

export function getAutocompleteCommands(teamId: string, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getAutocompleteCommandsList,
        onSuccess: [IntegrationTypes.RECEIVED_COMMANDS],
        params: [
            teamId,
            page,
            perPage,
        ],
    });
}

export function getCustomTeamCommands(teamId: string) {
    return bindClientFunc({
        clientFunc: Client4.getCustomTeamCommands,
        onSuccess: [IntegrationTypes.RECEIVED_CUSTOM_TEAM_COMMANDS],
        params: [
            teamId,
        ],
    });
}

export function addCommand(command: Command) {
    return bindClientFunc({
        clientFunc: Client4.addCommand,
        onSuccess: [IntegrationTypes.RECEIVED_COMMAND],
        params: [
            command,
        ],
    });
}

export function editCommand(command: Command) {
    return bindClientFunc({
        clientFunc: Client4.editCommand,
        onSuccess: [IntegrationTypes.RECEIVED_COMMAND],
        params: [
            command,
        ],
    });
}

export function executeCommand(command: string, args: CommandArgs) {
    return bindClientFunc({
        clientFunc: Client4.executeCommand,
        params: [
            command,
            args,
        ],
    });
}

export function regenCommandToken(id: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let res;
        try {
            res = await Client4.regenCommandToken(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: IntegrationTypes.RECEIVED_COMMAND_TOKEN,
                data: {
                    id,
                    token: res.token,
                },
            },
        ]));

        return {data: true};
    };
}

export function deleteCommand(id: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteCommand(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: IntegrationTypes.DELETED_COMMAND,
                data: {id},
            },
        ]));

        return {data: true};
    };
}

export function addOAuthApp(app: OAuthApp) {
    return bindClientFunc({
        clientFunc: Client4.createOAuthApp,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APP],
        params: [
            app,
        ],
    });
}

export function editOAuthApp(app: OAuthApp) {
    return bindClientFunc({
        clientFunc: Client4.editOAuthApp,
        onSuccess: IntegrationTypes.RECEIVED_OAUTH_APP,
        params: [
            app,
        ],
    });
}

export function getOAuthApps(page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getOAuthApps,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APPS],
        params: [
            page,
            perPage,
        ],
    });
}

export function getOutgoingOAuthConnections(teamId: string, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingOAuthConnections,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_OAUTH_CONNECTIONS],
        params: [
            teamId,
            page,
            perPage,
        ],
    });
}

export function getOutgoingOAuthConnectionsForAudience(teamId: string, audience: string, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingOAuthConnectionsForAudience,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_OAUTH_CONNECTIONS],
        params: [
            teamId,
            audience,
            page,
            perPage,
        ],
    });
}

export function addOutgoingOAuthConnection(teamId: string, connection: OutgoingOAuthConnection) {
    return bindClientFunc({
        clientFunc: Client4.createOutgoingOAuthConnection,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_OAUTH_CONNECTION],
        params: [
            teamId,
            connection,
        ],
    });
}

export function editOutgoingOAuthConnection(teamId: string, connection: OutgoingOAuthConnection) {
    return bindClientFunc({
        clientFunc: Client4.editOutgoingOAuthConnection,
        onSuccess: IntegrationTypes.RECEIVED_OUTGOING_OAUTH_CONNECTION,
        params: [
            teamId,
            connection,
        ],
    });
}

export function getOutgoingOAuthConnection(teamId: string, connectionId: string) {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingOAuthConnection,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_OAUTH_CONNECTION],
        params: [
            teamId,
            connectionId,
        ],
    });
}

export function validateOutgoingOAuthConnection(teamId: string, connection: OutgoingOAuthConnection) {
    return bindClientFunc({
        clientFunc: Client4.validateOutgoingOAuthConnection,
        params: [
            teamId,
            connection,
        ],
    });
}

export function getAppsOAuthAppIDs() {
    return bindClientFunc({
        clientFunc: Client4.getAppsOAuthAppIDs,
        onSuccess: [IntegrationTypes.RECEIVED_APPS_OAUTH_APP_IDS],
    });
}

export function getAppsBotIDs() {
    return bindClientFunc({
        clientFunc: Client4.getAppsBotIDs,
        onSuccess: [IntegrationTypes.RECEIVED_APPS_BOT_IDS],
    });
}

export function getOAuthApp(appId: string) {
    return bindClientFunc({
        clientFunc: Client4.getOAuthApp,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APP],
        params: [
            appId,
        ],
    });
}

export function getAuthorizedOAuthApps(): ActionFuncAsync<OAuthApp[]> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        let data;
        try {
            data = await Client4.getAuthorizedOAuthApps(currentUserId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));

            return {error};
        }

        return {data};
    };
}

export function deauthorizeOAuthApp(clientId: string) {
    return bindClientFunc({
        clientFunc: Client4.deauthorizeOAuthApp,
        params: [clientId],
    });
}

export function deleteOAuthApp(id: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteOAuthApp(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: IntegrationTypes.DELETED_OAUTH_APP,
                data: {id},
            },
        ]));

        return {data: true};
    };
}

export function regenOAuthAppSecret(appId: string) {
    return bindClientFunc({
        clientFunc: Client4.regenOAuthAppSecret,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APP],
        params: [
            appId,
        ],
    });
}

export function deleteOutgoingOAuthConnection(id: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteOutgoingOAuthConnection(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: IntegrationTypes.DELETED_OUTGOING_OAUTH_CONNECTION,
            data: {id},
        });

        return {data: true};
    };
}

export function submitInteractiveDialog(submission: DialogSubmission): ActionFuncAsync<SubmitDialogResponse> {
    return async (dispatch, getState) => {
        const state = getState();
        submission.channel_id = getCurrentChannelId(state);
        submission.team_id = getCurrentTeamId(state);

        let data;
        try {
            data = await Client4.submitInteractiveDialog(submission);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        return {data};
    };
}
