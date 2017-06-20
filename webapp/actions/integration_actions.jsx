// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import * as IntegrationActions from 'mattermost-redux/actions/integrations';

export function loadIncomingHooks(complete) {
    IntegrationActions.getIncomingHooks('', 0, 10000)(dispatch, getState).then(
        (data) => {
            if (data) {
                loadProfilesForIncomingHooks(data);
            }

            if (complete) {
                complete(data);
            }
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

    getProfilesByIds(list)(dispatch, getState);
}

export function loadOutgoingHooks(complete) {
    IntegrationActions.getOutgoingHooks('', '', 0, 10000)(dispatch, getState).then(
        (data) => {
            if (data) {
                loadProfilesForOutgoingHooks(data);
            }

            if (complete) {
                complete(data);
            }
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

    getProfilesByIds(list)(dispatch, getState);
}

export function loadTeamCommands(complete) {
    IntegrationActions.getCustomTeamCommands(TeamStore.getCurrentId())(dispatch, getState).then(
        (data) => {
            if (data) {
                loadProfilesForCommands(data);
            }

            if (complete) {
                complete(data);
            }
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

    getProfilesByIds(list)(dispatch, getState);
}

export function addIncomingHook(hook, success, error) {
    IntegrationActions.createIncomingHook(hook)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.createIncomingHook.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateIncomingHook(hook, success, error) {
    IntegrationActions.updateIncomingHook(hook)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.updateIncomingHook.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function addOutgoingHook(hook, success, error) {
    IntegrationActions.createOutgoingHook(hook)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.createOutgoingHook.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateOutgoingHook(hook, success, error) {
    IntegrationActions.updateOutgoingHook(hook)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.updateOutgoingHook.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function deleteIncomingHook(id) {
    IntegrationActions.removeIncomingHook(id)(dispatch, getState);
}

export function deleteOutgoingHook(id) {
    IntegrationActions.removeOutgoingHook(id)(dispatch, getState);
}

export function regenOutgoingHookToken(id) {
    IntegrationActions.regenOutgoingHookToken(id)(dispatch, getState);
}

export function addCommand(command, success, error) {
    IntegrationActions.addCommand(command)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.addCommand.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function editCommand(command, success, error) {
    IntegrationActions.editCommand(command)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.integrations.editCommand.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function deleteCommand(id) {
    IntegrationActions.deleteCommand(id)(dispatch, getState);
}

export function regenCommandToken(id) {
    IntegrationActions.regenCommandToken(id)(dispatch, getState);
}
