// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamStore from 'stores/team_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {Client4} from 'mattermost-redux/client';

import {getUser} from 'mattermost-redux/actions/users';
import {viewChannel} from 'mattermost-redux/actions/channels';
import * as TeamActions from 'mattermost-redux/actions/teams';

import {TeamTypes} from 'mattermost-redux/action_types';

export function checkIfTeamExists(teamName, onSuccess, onError) {
    TeamActions.checkIfTeamExists(teamName)(dispatch, getState).then(
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
    TeamActions.createTeam(team)(dispatch, getState).then(
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
    TeamActions.updateTeam(team)(dispatch, getState).then(
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
    TeamActions.removeUserFromTeam(teamId, userId)(dispatch, getState).then(
        (data) => {
            getUser(userId)(dispatch, getState);
            TeamActions.getTeamStats(teamId)(dispatch, getState);

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
    TeamActions.updateTeamMemberRoles(teamId, userId, newRoles)(dispatch, getState).then(
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
    Client4.addToTeamFromInvite(hash, data, inviteId).then(
        (member) => {
            TeamActions.getTeam(member.team_id)(dispatch, getState).then(
                (team) => {
                    dispatch({
                        type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
                        data: {
                            ...member,
                            delete_at: 0,
                            msg_count: 0,
                            mention_count: 0
                        }
                    });

                    if (success) {
                        success(team);
                    }
                }
            );
        },
    ).catch(
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function addUsersToTeam(teamId, userIds, success, error) {
    TeamActions.addUsersToTeam(teamId, userIds)(dispatch, getState).then(
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
    Client4.getTeamInviteInfo(inviteId).then(
        (inviteData) => {
            if (success) {
                success(inviteData);
            }
        }
    ).catch(
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
    TeamActions.sendEmailInvitesToTeam(TeamStore.getCurrentId(), emails)(dispatch, getState).then(
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
    TeamActions.getTeamsForUser(userId)(dispatch, getState).then(
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
    TeamActions.getTeamMembersForUser(userId)(dispatch, getState).then(
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
