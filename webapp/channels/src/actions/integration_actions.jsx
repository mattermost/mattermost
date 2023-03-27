// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as IntegrationActions from 'mattermost-redux/actions/integrations';
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';

const DEFAULT_PAGE_SIZE = 100;

export function loadIncomingHooksAndProfilesForTeam(teamId, page = 0, perPage = DEFAULT_PAGE_SIZE) {
    return async (dispatch) => {
        const {data} = await dispatch(IntegrationActions.getIncomingHooks(teamId, page, perPage));
        if (data) {
            dispatch(loadProfilesForIncomingHooks(data));
        }
    };
}

export function loadProfilesForIncomingHooks(hooks) {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad = {};
        for (let i = 0; i < hooks.length; i++) {
            const hook = hooks[i];
            if (!getUser(state, hook.user_id)) {
                profilesToLoad[hook.user_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return;
        }

        dispatch(getProfilesByIds(list));
    };
}

export function loadOutgoingHooksAndProfilesForTeam(teamId, page = 0, perPage = DEFAULT_PAGE_SIZE) {
    return async (dispatch) => {
        const {data} = await dispatch(IntegrationActions.getOutgoingHooks('', teamId, page, perPage));
        if (data) {
            dispatch(loadProfilesForOutgoingHooks(data));
        }
    };
}

export function loadProfilesForOutgoingHooks(hooks) {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad = {};
        for (let i = 0; i < hooks.length; i++) {
            const hook = hooks[i];
            if (!getUser(state, hook.creator_id)) {
                profilesToLoad[hook.creator_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return;
        }

        dispatch(getProfilesByIds(list));
    };
}

export function loadCommandsAndProfilesForTeam(teamId) {
    return async (dispatch) => {
        const {data} = await dispatch(IntegrationActions.getCustomTeamCommands(teamId));
        if (data) {
            dispatch(loadProfilesForCommands(data));
        }
    };
}

export function loadProfilesForCommands(commands) {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad = {};
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            if (!getUser(state, command.creator_id)) {
                profilesToLoad[command.creator_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return;
        }

        dispatch(getProfilesByIds(list));
    };
}

export function loadOAuthAppsAndProfiles(page = 0, perPage = DEFAULT_PAGE_SIZE) {
    return async (dispatch, getState) => {
        if (appsEnabled(getState())) {
            dispatch(IntegrationActions.getAppsOAuthAppIDs());
        }
        const {data} = await dispatch(IntegrationActions.getOAuthApps(page, perPage));
        if (data) {
            dispatch(loadProfilesForOAuthApps(data));
        }
    };
}

export function loadProfilesForOAuthApps(apps) {
    return async (dispatch, getState) => {
        const state = getState();
        const profilesToLoad = {};
        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            if (!getUser(state, app.creator_id)) {
                profilesToLoad[app.creator_id] = true;
            }
        }

        const list = Object.keys(profilesToLoad);
        if (list.length === 0) {
            return;
        }

        dispatch(getProfilesByIds(list));
    };
}
