// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import {ActionTypes} from 'utils/constants.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {Client4} from 'mattermost-redux/client';

import {getProfilesByIds} from 'mattermost-redux/actions/users';
import * as IntegrationActions from 'mattermost-redux/actions/integrations';

import request from 'superagent';

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

export function loadIncomingHooksForTeam(teamId, complete) {
    IntegrationActions.getIncomingHooks(teamId, 0, 10000)(dispatch, getState).then(
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

export function loadOutgoingHooksForTeam(teamId, complete) {
    IntegrationActions.getOutgoingHooks('', teamId, 0, 10000)(dispatch, getState).then(
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

export function getSuggestedCommands(command, suggestionId, component) {
    Client4.getCommandsList(TeamStore.getCurrentId()).then(
        (data) => {
            let matches = [];
            data.forEach((cmd) => {
                if (!cmd.auto_complete) {
                    return;
                }

                if (cmd.trigger !== 'shortcuts' || !UserAgent.isMobile()) {
                    if (('/' + cmd.trigger).indexOf(command) === 0) {
                        const s = '/' + cmd.trigger;
                        let hint = '';
                        if (cmd.auto_complete_hint && cmd.auto_complete_hint.length !== 0) {
                            hint = cmd.auto_complete_hint;
                        }
                        matches.push({
                            suggestion: s,
                            hint,
                            description: cmd.auto_complete_desc
                        });
                    }
                }
            });

            matches = matches.sort((a, b) => a.suggestion.localeCompare(b.suggestion));

            // pull out the suggested commands from the returned data
            const terms = matches.map((suggestion) => suggestion.suggestion);

            if (terms.length > 0) {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                    id: suggestionId,
                    matchedPretext: command,
                    terms,
                    items: matches,
                    component
                });
            }
        }
    ).catch(
        () => {} //eslint-disable-line no-empty-function
    );
}

export function getYoutubeVideoInfo(googleKey, videoId, success, error) {
    request.get('https://www.googleapis.com/youtube/v3/videos').
    query({part: 'snippet', id: videoId, key: googleKey}).
    end((err, res) => {
        if (err) {
            return error(err);
        }

        if (!res.body) {
            console.error('Missing response body for getYoutubeVideoInfo'); // eslint-disable-line no-console
        }

        return success(res.body);
    });
}
