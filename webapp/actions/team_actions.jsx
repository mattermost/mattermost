// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamStore from 'stores/team_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import Client from 'client/web_client.jsx';

import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {getUser} from 'mattermost-redux/actions/users';
import {viewChannel} from 'mattermost-redux/actions/channels';
import {
    createTeam as createTeamRedux,
    updateTeam as updateTeamRedux,
    removeUserFromTeam as removeUserFromTeamRedux,
    getTeamStats,
    checkIfTeamExists as checkIfTeamExistsRedux,
    updateTeamMemberRoles as updateTeamMemberRolesRedux,
    addUsersToTeam as addUsersToTeamRedux,
    sendEmailInvitesToTeam,
    getTeamsForUser as getTeamsForUserRedux,
    getTeamMembersForUser as getTeamMembersForUserRedux
} from 'mattermost-redux/actions/teams';

import {TeamTypes} from 'mattermost-redux/action_types';
import {batchActions} from 'redux-batched-actions';

export function checkIfTeamExists(teamName, onSuccess, onError) {
    checkIfTeamExistsRedux(teamName)(dispatch, getState).then(
        (exists) => {
            if (exists != null && onSuccess) {
                onSuccess(exists);
            } else if (exists == null && onError) {
                const serverError = getState().requests.teams.getTeam.error;
                onError({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function createTeam(team, onSuccess, onError) {
    createTeamRedux(team)(dispatch, getState).then(
        (rteam) => {
            if (rteam && onSuccess) {
                browserHistory.push('/' + rteam.name + '/channels/town-square');
                onSuccess(rteam);
            } else if (rteam == null && onError) {
                const serverError = getState().requests.teams.createTeam.error;
                onError({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateTeam(team, onSuccess, onError) {
    updateTeamRedux(team)(dispatch, getState).then(
        (rteam) => {
            if (rteam && onSuccess) {
                browserHistory.push('/' + rteam.name + '/channels/town-square');
                onSuccess(rteam);
            } else if (rteam == null && onError) {
                const serverError = getState().requests.teams.updateTeam.error;
                onError({id: serverError.server_error_id, ...serverError});
            }
        },
    );
}

export function removeUserFromTeam(teamId, userId, success, error) {
    removeUserFromTeamRedux(teamId, userId)(dispatch, getState).then(
        (data) => {
            getUser(userId)(dispatch, getState);
            getTeamStats(teamId)(dispatch, getState);

            if (data && success) {
                success();
            } else if (data == null && error) {
                const serverError = getState().requests.teams.removeUserFromTeam.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        },
    );
}

export function updateTeamMemberRoles(teamId, userId, newRoles, success, error) {
    updateTeamMemberRolesRedux(teamId, userId, newRoles)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success();
            } else if (data == null && error) {
                const serverError = getState().requests.teams.updateTeamMember.error;
                error({id: serverError.server_error_id, ...serverError});
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
            const member = {
                team_id: team.id,
                user_id: getState().entities.users.currentUserId,
                roles: 'team_user',
                delete_at: 0,
                msg_count: 0,
                mention_count: 0
            };

            dispatch(batchActions([
                {
                    type: TeamTypes.RECEIVED_TEAMS_LIST,
                    data: [team]
                },
                {
                    type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
                    data: member
                }
            ]));

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
    addUsersToTeamRedux(teamId, userIds)(dispatch, getState).then(
        (teamMembers) => {
            if (teamMembers && success) {
                success(teamMembers);
            } else if (teamMembers == null && error) {
                const serverError = getState().requests.teams.addUserToTeam.error;
                error({id: serverError.server_error_id, ...serverError});
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
    if (!data.invites) {
        success();
    }
    const emails = [];
    data.invites.forEach((i) => {
        emails.push(i.email);
    });
    sendEmailInvitesToTeam(TeamStore.getCurrentId(), emails)(dispatch, getState).then(
        (result) => {
            if (result && success) {
                success();
            } else if (result == null && error) {
                const serverError = getState().requests.teams.emailInvite.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function switchTeams(url) {
    viewChannel(ChannelStore.getCurrentId())(dispatch, getState);
    browserHistory.push(url);
}

export function getTeamsForUser(userId, success, error) {
    getTeamsForUserRedux(userId)(dispatch, getState).then(
        (result) => {
            if (result && success) {
                success(result);
            } else if (result == null && error) {
                const serverError = getState().requests.teams.getTeams.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function getTeamMembersForUser(userId, success, error) {
    getTeamMembersForUserRedux(userId)(dispatch, getState).then(
        (result) => {
            if (result && success) {
                success(result);
            } else if (result == null && error) {
                const serverError = getState().requests.teams.getTeamMembers.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}
