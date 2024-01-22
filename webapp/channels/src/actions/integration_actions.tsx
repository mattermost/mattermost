// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IncomingWebhook, OutgoingWebhook, Command, OAuthApp} from '@mattermost/types/integrations';

import * as IntegrationActions from 'mattermost-redux/actions/integrations';
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, NewActionFuncAsync} from 'mattermost-redux/types/actions';

const DEFAULT_PAGE_SIZE = 100;

export function loadIncomingHooksAndProfilesForTeam(teamId: string, page = 0, perPage = DEFAULT_PAGE_SIZE): NewActionFuncAsync<IncomingWebhook[]> {
    return async (dispatch) => {
        const {data} = await dispatch(IntegrationActions.getIncomingHooks(teamId, page, perPage));
        if (data) {
            dispatch(loadProfilesForIncomingHooks(data));
        }
        return {data};
    };
}

export function loadProfilesForIncomingHooks(hooks: IncomingWebhook[]): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad: {[key: string]: boolean} = {};
        for (let i = 0; i < hooks.length; i++) {
            const hook = hooks[i];
            if (!getUser(state, hook.user_id)) {
                profilesToLoad[hook.user_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return {data: null};
        }

        dispatch(getProfilesByIds(list));
        return {data: null};
    };
}

export function loadOutgoingHooksAndProfilesForTeam(teamId: string, page = 0, perPage = DEFAULT_PAGE_SIZE): NewActionFuncAsync<OutgoingWebhook[]> {
    return async (dispatch) => {
        const {data} = await dispatch(IntegrationActions.getOutgoingHooks('', teamId, page, perPage));
        if (data) {
            dispatch(loadProfilesForOutgoingHooks(data));
        }
        return {data};
    };
}

export function loadProfilesForOutgoingHooks(hooks: OutgoingWebhook[]): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad: {[key: string]: boolean} = {};
        for (let i = 0; i < hooks.length; i++) {
            const hook = hooks[i];
            if (!getUser(state, hook.creator_id)) {
                profilesToLoad[hook.creator_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return {data: null};
        }

        dispatch(getProfilesByIds(list));
        return {data: null};
    };
}

export function loadCommandsAndProfilesForTeam(teamId: string): ActionFunc {
    return async (dispatch) => {
        const {data} = await dispatch(IntegrationActions.getCustomTeamCommands(teamId));
        if (data) {
            dispatch(loadProfilesForCommands(data));
        }
        return {data};
    };
}

export function loadProfilesForCommands(commands: Command[]): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad: {[key: string]: boolean} = {};
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            if (!getUser(state, command.creator_id)) {
                profilesToLoad[command.creator_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return {data: null};
        }

        dispatch(getProfilesByIds(list));
        return {data: null};
    };
}

export function loadOAuthAppsAndProfiles(page = 0, perPage = DEFAULT_PAGE_SIZE): NewActionFuncAsync {
    return async (dispatch, getState) => {
        if (appsEnabled(getState())) {
            dispatch(IntegrationActions.getAppsOAuthAppIDs());
        }
        const {data} = await dispatch(IntegrationActions.getOAuthApps(page, perPage));
        if (data) {
            dispatch(loadProfilesForOAuthApps(data));
        }
        return {data: null};
    };
}

export function loadProfilesForOAuthApps(apps: OAuthApp[]): ActionFunc {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad: {[key: string]: boolean} = {};
        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            if (!getUser(state, app.creator_id)) {
                profilesToLoad[app.creator_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return {data: null};
        }

        dispatch(getProfilesByIds(list));
        return {data: null};
    };
}
