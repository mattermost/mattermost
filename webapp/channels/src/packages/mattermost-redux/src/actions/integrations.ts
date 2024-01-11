// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Command, CommandArgs, CommandResponse, DialogSubmission, IncomingWebhook, OAuthApp, OutgoingWebhook, SubmitDialogResponse} from '@mattermost/types/integrations';

import {IntegrationTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import {General} from '../constants';

export function createIncomingHook(hook: IncomingWebhook): NewActionFuncAsync<IncomingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.createIncomingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOK],
        params: [
            hook,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getIncomingHook(hookId: string): NewActionFuncAsync<IncomingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.getIncomingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOK],
        params: [
            hookId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getIncomingHooks(teamId = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<IncomingWebhook[]> {
    return bindClientFunc({
        clientFunc: Client4.getIncomingWebhooks,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOKS],
        params: [
            teamId,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removeIncomingHook(hookId: string): NewActionFuncAsync {
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

export function updateIncomingHook(hook: IncomingWebhook): NewActionFuncAsync<IncomingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.updateIncomingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_INCOMING_HOOK],
        params: [
            hook,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function createOutgoingHook(hook: OutgoingWebhook): NewActionFuncAsync<OutgoingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.createOutgoingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hook,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getOutgoingHook(hookId: string): NewActionFuncAsync<OutgoingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hookId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getOutgoingHooks(channelId = '', teamId = '', page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<OutgoingWebhook[]> {
    return bindClientFunc({
        clientFunc: Client4.getOutgoingWebhooks,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOKS],
        params: [
            channelId,
            teamId,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removeOutgoingHook(hookId: string): NewActionFuncAsync {
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

export function updateOutgoingHook(hook: OutgoingWebhook): NewActionFuncAsync<OutgoingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.updateOutgoingWebhook,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hook,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function regenOutgoingHookToken(hookId: string): NewActionFuncAsync<OutgoingWebhook> {
    return bindClientFunc({
        clientFunc: Client4.regenOutgoingHookToken,
        onSuccess: [IntegrationTypes.RECEIVED_OUTGOING_HOOK],
        params: [
            hookId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getCommands(teamId: string): NewActionFuncAsync<Command[]> { // HARRISONTODO remove me
    return bindClientFunc({
        clientFunc: Client4.getCommandsList,
        onSuccess: [IntegrationTypes.RECEIVED_COMMANDS],
        params: [
            teamId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getAutocompleteCommands(teamId: string, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<Command[]> { // HARRISONTODO remove me
    return bindClientFunc({
        clientFunc: Client4.getAutocompleteCommandsList,
        onSuccess: [IntegrationTypes.RECEIVED_COMMANDS],
        params: [
            teamId,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getCustomTeamCommands(teamId: string): NewActionFuncAsync<Command[]> {
    return bindClientFunc({
        clientFunc: Client4.getCustomTeamCommands,
        onSuccess: [IntegrationTypes.RECEIVED_CUSTOM_TEAM_COMMANDS],
        params: [
            teamId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function addCommand(command: Command): NewActionFuncAsync<Command> {
    return bindClientFunc({
        clientFunc: Client4.addCommand,
        onSuccess: [IntegrationTypes.RECEIVED_COMMAND],
        params: [
            command,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function editCommand(command: Command): NewActionFuncAsync<Command> {
    return bindClientFunc({
        clientFunc: Client4.editCommand,
        onSuccess: [IntegrationTypes.RECEIVED_COMMAND],
        params: [
            command,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function executeCommand(command: string, args: CommandArgs): NewActionFuncAsync<CommandResponse> { // HARRISONTODO remove me
    return bindClientFunc({
        clientFunc: Client4.executeCommand,
        params: [
            command,
            args,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function regenCommandToken(id: string): NewActionFuncAsync {
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

export function deleteCommand(id: string): NewActionFuncAsync {
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

export function addOAuthApp(app: OAuthApp): NewActionFuncAsync<OAuthApp> {
    return bindClientFunc({
        clientFunc: Client4.createOAuthApp,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APP],
        params: [
            app,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function editOAuthApp(app: OAuthApp): NewActionFuncAsync<OAuthApp> {
    return bindClientFunc({
        clientFunc: Client4.editOAuthApp,
        onSuccess: IntegrationTypes.RECEIVED_OAUTH_APP,
        params: [
            app,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getOAuthApps(page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<OAuthApp[]> {
    return bindClientFunc({
        clientFunc: Client4.getOAuthApps,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APPS],
        params: [
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getAppsOAuthAppIDs(): NewActionFuncAsync<string[]> {
    return bindClientFunc({
        clientFunc: Client4.getAppsOAuthAppIDs,
        onSuccess: [IntegrationTypes.RECEIVED_APPS_OAUTH_APP_IDS],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getAppsBotIDs(): NewActionFuncAsync<string[]> {
    return bindClientFunc({
        clientFunc: Client4.getAppsBotIDs,
        onSuccess: [IntegrationTypes.RECEIVED_APPS_BOT_IDS],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getOAuthApp(appId: string): NewActionFuncAsync<OAuthApp> {
    return bindClientFunc({
        clientFunc: Client4.getOAuthApp,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APP],
        params: [
            appId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getAuthorizedOAuthApps(): NewActionFuncAsync<OAuthApp[]> {
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

export function deauthorizeOAuthApp(clientId: string): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deauthorizeOAuthApp,
        params: [clientId],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function deleteOAuthApp(id: string): NewActionFuncAsync {
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

export function regenOAuthAppSecret(appId: string): NewActionFuncAsync<OAuthApp> {
    return bindClientFunc({
        clientFunc: Client4.regenOAuthAppSecret,
        onSuccess: [IntegrationTypes.RECEIVED_OAUTH_APP],
        params: [
            appId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function submitInteractiveDialog(submission: DialogSubmission): NewActionFuncAsync<SubmitDialogResponse> {
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
