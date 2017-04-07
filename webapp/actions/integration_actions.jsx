// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import {ActionTypes} from 'utils/constants.jsx';

export function loadIncomingHooks() {
    Client.listIncomingHooks(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_INCOMING_WEBHOOKS,
                teamId: TeamStore.getCurrentId(),
                incomingWebhooks: data
            });

            loadProfilesForIncomingHooks(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'listIncomingHooks');
        }
    );
}

function loadProfilesForIncomingHooks(hooks) {
    const profilesToLoad = {};
    for (let i = 0; i < hooks.length; i++) {
        const hook = hooks[i];
        if (!UserStore.hasProfile(hook.user_id)) {
            profilesToLoad[hook.user_id] = true;
        }
    }

    const list = Object.keys(profilesToLoad);
    if (list.length === 0) {
        return;
    }

    AsyncClient.getProfilesByIds(list);
}

export function loadOutgoingHooks() {
    Client.listOutgoingHooks(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_OUTGOING_WEBHOOKS,
                teamId: TeamStore.getCurrentId(),
                outgoingWebhooks: data
            });

            loadProfilesForOutgoingHooks(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'listOutgoingHooks');
        }
    );
}

function loadProfilesForOutgoingHooks(hooks) {
    const profilesToLoad = {};
    for (let i = 0; i < hooks.length; i++) {
        const hook = hooks[i];
        if (!UserStore.hasProfile(hook.creator_id)) {
            profilesToLoad[hook.creator_id] = true;
        }
    }

    const list = Object.keys(profilesToLoad);
    if (list.length === 0) {
        return;
    }

    AsyncClient.getProfilesByIds(list);
}

export function loadTeamCommands() {
    Client.listTeamCommands(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_COMMANDS,
                teamId: Client.teamId,
                commands: data
            });

            loadProfilesForCommands(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'loadTeamCommands');
        }
    );
}

function loadProfilesForCommands(commands) {
    const profilesToLoad = {};
    for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        if (!UserStore.hasProfile(command.creator_id)) {
            profilesToLoad[command.creator_id] = true;
        }
    }

    const list = Object.keys(profilesToLoad);
    if (list.length === 0) {
        return;
    }

    AsyncClient.getProfilesByIds(list);
}
