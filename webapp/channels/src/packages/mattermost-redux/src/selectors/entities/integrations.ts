// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IncomingWebhook, OutgoingWebhook, Command} from '@mattermost/types/integrations';
import type {GlobalState} from '@mattermost/types/store';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {appsEnabled} from './apps';

export function getIncomingHooks(state: GlobalState) {
    return state.entities.integrations.incomingHooks;
}

export function getIncomingHooksTotalCount(state: GlobalState) {
    return state.entities.integrations.incomingHooksTotalCount;
}

export function getOutgoingHooks(state: GlobalState) {
    return state.entities.integrations.outgoingHooks;
}

export function getCommands(state: GlobalState) {
    return state.entities.integrations.commands;
}

export function getOAuthApps(state: GlobalState) {
    return state.entities.integrations.oauthApps;
}

export function getOutgoingOAuthConnections(state: GlobalState) {
    return state.entities.integrations.outgoingOAuthConnections;
}

export const getFilteredIncomingHooks: (state: GlobalState) => IncomingWebhook[] = createSelector(
    'getFilteredIncomingHooks',
    getCurrentTeamId,
    getIncomingHooks,
    (teamId, hooks) => {
        return Object.keys(hooks).
            map((key) => hooks[key]).
            filter((incomingHook) => incomingHook.team_id === teamId);
    },
);

export const getAppsOAuthAppIDs: (state: GlobalState) => string[] = createSelector(
    'getAppsOAuthAppIDs',
    appsEnabled,
    (state: GlobalState) => state.entities.integrations.appsOAuthAppIDs,
    (apps, ids) => {
        return apps ? ids : [];
    },
);

export const getAppsBotIDs: (state: GlobalState) => string[] = createSelector(
    'getAppsBotIDs',
    appsEnabled,
    (state: GlobalState) => state.entities.integrations.appsBotIDs,
    (apps, ids) => {
        return apps ? ids : [];
    },
);

export function getSystemCommands(state: GlobalState) {
    return state.entities.integrations.systemCommands;
}

/**
 * get outgoing hooks in current team
 */
export const getOutgoingHooksInCurrentTeam: (state: GlobalState) => OutgoingWebhook[] = createSelector(
    'getOutgoingHooksInCurrentTeam',
    getCurrentTeamId,
    getOutgoingHooks,
    (teamId, hooks) => {
        return Object.values(hooks).filter((o) => o.team_id === teamId);
    },
);

export const getAllCommands: (state: GlobalState) => IDMappedObjects<Command> = createSelector(
    'getAllCommands',
    getCommands,
    getSystemCommands,
    (commands, systemCommands) => {
        return {
            ...commands,
            ...systemCommands,
        };
    },
);

export const getAutocompleteCommandsList: (state: GlobalState) => Command[] = createSelector(
    'getAutocompleteCommandsList',
    getAllCommands,
    getCurrentTeamId,
    (commands, currentTeamId) => {
        return Object.values(commands).filter((command) => {
            return command && (!command.team_id || command.team_id === currentTeamId) && command.auto_complete;
        }).sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
);
