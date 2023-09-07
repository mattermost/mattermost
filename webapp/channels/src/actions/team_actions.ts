// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {ServerError} from '@mattermost/types/errors';
import {UserProfile} from '@mattermost/types/users';

import {TeamTypes} from 'mattermost-redux/action_types';
import {ActionFunc, ActionResult, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {getChannelStats} from 'mattermost-redux/actions/channels';
import * as TeamActions from 'mattermost-redux/actions/teams';
import {getUser} from 'mattermost-redux/actions/users';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {getHistory} from 'utils/browser_history';
import {Preferences} from 'utils/constants';
import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'types/store';
import {setGlobalItem} from 'actions/storage';
import {syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getConnectionId} from 'selectors/general';
import {logError} from 'mattermost-redux/actions/errors';

export function removeUserFromTeamAndGetStats(teamId: Team['id'], userId: UserProfile['id']): ActionFunc {
    return async (dispatch, getState) => {
        const response = await dispatch(TeamActions.removeUserFromTeam(teamId, userId));
        dispatch(getUser(userId));
        dispatch(TeamActions.getTeamStats(teamId));
        dispatch(getChannelStats(getCurrentChannelId(getState())));
        return response;
    };
}

export function addUserToTeamFromInvite(token: string, inviteId: string): ActionFunc {
    return async (dispatch) => {
        const {data: member, error} = await dispatch(TeamActions.addUserToTeamFromInvite(token, inviteId));
        if (member) {
            const {data} = await dispatch(TeamActions.getTeam(member.team_id));

            dispatch({
                type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
                data: {
                    ...member,
                    delete_at: 0,
                    msg_count: 0,
                    mention_count: 0,
                },
            });

            return {data};
        }
        return {error};
    };
}

export function addUserToTeam(teamId: Team['id'], userId: UserProfile['id']): ActionFunc<Team, ServerError> {
    return async (dispatch) => {
        const {data: member, error} = await dispatch(TeamActions.addUserToTeam(teamId, userId));
        if (member) {
            const {data} = await dispatch(TeamActions.getTeam(member.team_id));

            dispatch({
                type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
                data: {
                    ...member,
                    delete_at: 0,
                    msg_count: 0,
                    mention_count: 0,
                },
            });

            return {data};
        }
        return {error};
    };
}

export function addUsersToTeam(teamId: Team['id'], userIds: Array<UserProfile['id']>): ActionFunc {
    return async (dispatch, getState) => {
        const {data, error} = await dispatch(TeamActions.addUsersToTeamGracefully(teamId, userIds));

        if (error) {
            return {error};
        }

        dispatch(getChannelStats(getCurrentChannelId(getState())));

        return {data};
    };
}

export function switchTeam(url: string, team?: Team) {
    return (dispatch: DispatchFunc) => {
        // In Channels, the team argument is undefined, and team switching is done by pushing a URL onto history.
        // In other products, a team is passed instead of a URL because the current team isn't tied to the page URL.
        //
        // Note that url may also be a non-team URL since this is called when switching to the Create Team page
        // from the team sidebar as well.
        if (team) {
            dispatch(selectTeam(team));
        } else {
            getHistory().push(url);
        }
    };
}

export function updateTeamsOrderForUser(teamIds: Array<Team['id']>) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const teamOrderPreferences = [{
            user_id: currentUserId,
            name: '',
            category: Preferences.TEAMS_ORDER,
            value: teamIds.join(','),
        }];
        dispatch(savePreferences(currentUserId, teamOrderPreferences));
    };
}

export function getGroupMessageMembersCommonTeams(channelId: string): ActionFunc<Team[], ServerError> {
    return async (dispatch) => {
        let teams: Team[];

        try {
            const response = await Client4.getGroupMessageMembersCommonTeams(channelId);
            teams = response.data;
        } catch (error) {
            dispatch(logError(error as ServerError));
            return {error: error as ServerError};
        }

        return {data: teams};
    };
}
