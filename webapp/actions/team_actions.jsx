// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {getUser} from 'mattermost-redux/actions/users';

export function checkIfTeamExists(teamName, onSuccess, onError) {
    Client.findTeamByName(teamName, onSuccess, onError);
}

export function createTeam(team, onSuccess, onError) {
    Client.createTeam(team,
        (rteam) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.CREATED_TEAM,
                team: rteam,
                member: {team_id: rteam.id, user_id: UserStore.getCurrentId(), roles: 'team_admin team_user'}
            });

            browserHistory.push('/' + rteam.name + '/channels/town-square');

            if (onSuccess) {
                onSuccess(rteam);
            }
        },
        onError
    );
}

export function updateTeam(team, onSuccess, onError) {
    Client.updateTeam(team,
        (rteam) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.UPDATE_TEAM,
                team: rteam
            });

            browserHistory.push('/' + rteam.name + '/channels/town-square');

            if (onSuccess) {
                onSuccess(rteam);
            }
        },
        onError
    );
}

export function removeUserFromTeam(teamId, userId, success, error) {
    Client.removeUserFromTeam(
        teamId,
        userId,
        () => {
            TeamStore.removeMemberInTeam(teamId, userId);
            UserStore.removeProfileFromTeam(teamId, userId);
            UserStore.emitInTeamChange();
            getUser(userId)(dispatch, getState);
            AsyncClient.getTeamStats(teamId);

            if (success) {
                success();
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'removeUserFromTeam');

            if (error) {
                error(err);
            }
        }
    );
}

export function updateTeamMemberRoles(teamId, userId, newRoles, success, error) {
    Client.updateTeamMemberRoles(teamId, userId, newRoles,
        () => {
            AsyncClient.getTeamMember(teamId, userId);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function addUserToTeamFromInvite(data, hash, inviteId, success, error) {
    Client.addUserToTeamFromInvite(
        data,
        hash,
        inviteId,
        (team) => {
            if (success) {
                success(team);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function addUsersToTeam(teamId, userIds, success, error) {
    Client.addUsersToTeam(
        teamId,
        userIds,
        (teamMembers) => {
            teamMembers.forEach((member) => {
                TeamStore.removeMemberNotInTeam(teamId, member.user_id);
                UserStore.removeProfileNotInTeam(teamId, member.user_id);
            });
            UserStore.emitNotInTeamChange();

            if (success) {
                success(teamMembers);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'addUsersToTeam');

            if (error) {
                error(err);
            }
        }
    );
}

export function getInviteInfo(inviteId, success, error) {
    Client.getInviteInfo(
        inviteId,
        (inviteData) => {
            if (success) {
                success(inviteData);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function inviteMembers(data, success, error) {
    Client.inviteMembers(
        data,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (err) {
                error(err);
            }
        }
    );
}

export function switchTeams(url) {
    AsyncClient.viewChannel();
    browserHistory.push(url);
}

export function getTeamsForUser(userId, success, error) {
    Client.getTeamsForUser(userId, success, error);
}

export function getTeamMembersForUser(userId, success, error) {
    Client.getTeamMembersForUser(userId, success, error);
}
