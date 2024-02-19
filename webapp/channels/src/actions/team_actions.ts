// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {Team, TeamMemberWithError} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {TeamTypes} from 'mattermost-redux/action_types';
import {getChannelStats} from 'mattermost-redux/actions/channels';
import {logError} from 'mattermost-redux/actions/errors';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import * as TeamActions from 'mattermost-redux/actions/teams';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getUser} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';

import {getHistory} from 'utils/browser_history';
import {Preferences} from 'utils/constants';

export function removeUserFromTeamAndGetStats(teamId: Team['id'], userId: UserProfile['id']): ActionFuncAsync {
    return async (dispatch, getState) => {
        const response = await dispatch(TeamActions.removeUserFromTeam(teamId, userId));
        dispatch(getUser(userId));
        dispatch(TeamActions.getTeamStats(teamId));
        dispatch(getChannelStats(getCurrentChannelId(getState())));
        return response;
    };
}

export function addUserToTeamFromInvite(token: string, inviteId: string): ActionFuncAsync<Team> {
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

export function addUserToTeam(teamId: Team['id'], userId: UserProfile['id']): ActionFuncAsync<Team> {
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

export function addUsersToTeam(teamId: Team['id'], userIds: Array<UserProfile['id']>): ActionFuncAsync<TeamMemberWithError[]> {
    return async (dispatch, getState) => {
        const {data, error} = await dispatch(TeamActions.addUsersToTeamGracefully(teamId, userIds));

        if (error) {
            return {error};
        }

        dispatch(getChannelStats(getCurrentChannelId(getState())));

        return {data};
    };
}

export function switchTeam(url: string, team?: Team): ThunkActionFunc<void> {
    return (dispatch) => {
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

export function updateTeamsOrderForUser(teamIds: Array<Team['id']>): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const teamOrderPreferences = [{
            user_id: currentUserId,
            name: '',
            category: Preferences.TEAMS_ORDER,
            value: teamIds.join(','),
        }];
        return dispatch(savePreferences(currentUserId, teamOrderPreferences));
    };
}

export function getGroupMessageMembersCommonTeams(channelId: string): ActionFuncAsync<Team[]> {
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
