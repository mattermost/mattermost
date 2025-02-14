// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {History} from 'history';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {joinChannel, getChannelByNameAndTeamName, getChannelMember, markGroupChannelOpen, fetchChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {getUser, getUserByUsername, getUserByEmail} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getChannelByName, getOtherChannels, getChannel, getChannelsNameMapInTeam, getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {getTeamByName, getMyTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser, getCurrentUserId, getUserByUsername as selectUserByUsername, getUser as selectUser, getUserByEmail as selectUserByEmail} from 'mattermost-redux/selectors/entities/users';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import * as GlobalActions from 'actions/global_actions';

import {joinPrivateChannelPrompt} from 'utils/channel_utils';
import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {ActionFuncAsync} from 'types/store';

import type {Match, MatchAndHistory} from './channel_identifier_router';

const LENGTH_OF_ID = 26;
const LENGTH_OF_GROUP_ID = 40;
const LENGTH_OF_USER_ID_PAIR = 54;
const USER_ID_PAIR_REGEXP = new RegExp(`^[a-zA-Z0-9]{${LENGTH_OF_ID}}__[a-zA-Z0-9]{${LENGTH_OF_ID}}$`);

export function onChannelByIdentifierEnter({match, history}: MatchAndHistory): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {path, identifier, team} = match.params;

        if (!identifier) {
            return {data: undefined};
        }

        const teamObj = getTeamByName(state, team);
        if (!teamObj) {
            return {data: undefined};
        }

        const channelPath = await getPathFromIdentifier(state, path, identifier);

        switch (channelPath) {
        case 'channel_name':
            dispatch(goToChannelByChannelName(match, history));
            break;
        case 'channel_id':
            dispatch(goToChannelByChannelId(match, history));
            break;
        case 'group_channel_group_id':
            dispatch(goToGroupChannelByGroupId(match, history));
            break;
        case 'direct_channel_username':
            dispatch(goToDirectChannelByUsername(match, history));
            break;
        case 'direct_channel_email':
            dispatch(goToDirectChannelByEmail(match, history));
            break;
        case 'direct_channel_user_ids':
            dispatch(goToDirectChannelByUserIds(match, history));
            break;
        case 'direct_channel_user_id':
            dispatch(goToDirectChannelByUserId(match, history, identifier));
            break;
        case 'error':
            await dispatch(fetchChannelsAndMembers(teamObj!.id));
            handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
            break;
        }
        return {data: undefined};
    };
}

export async function getPathFromIdentifier(state: GlobalState, path: string, identifier: string) {
    if (path === 'channels') {
        // It's hard to tell an ID apart from a channel name of the same length, so check first if
        // the identifier matches a channel that we have
        const channelsByName = getChannelByName(state, identifier);
        const moreChannelsByName = getOtherChannels(state).find((chan) => chan.name === identifier);

        if (identifier.length === LENGTH_OF_ID) {
            if (!channelsByName && !moreChannelsByName) {
                try {
                    await Client4.getChannel(identifier);
                    return 'channel_id';
                } catch (e) {
                    if (e.status_code === 404) {
                        return 'channel_name';
                    }
                    return 'error';
                }
            }
            return 'channel_name';
        } else if (
            (!channelsByName && !moreChannelsByName && identifier.length === LENGTH_OF_GROUP_ID) ||
            (
                (channelsByName && channelsByName.type === Constants.GM_CHANNEL) ||
                (moreChannelsByName && moreChannelsByName.type === Constants.GM_CHANNEL)
            )
        ) {
            return 'group_channel_group_id';
        } else if (isDirectChannelIdentifier(identifier)) {
            return 'direct_channel_user_ids';
        }
        return 'channel_name';
    } else if (path === 'messages') {
        if (identifier.indexOf('@') === 0) {
            return 'direct_channel_username';
        } else if (identifier.indexOf('@') > 0) {
            return 'direct_channel_email';
        } else if (identifier.length === LENGTH_OF_ID) {
            return 'direct_channel_user_id';
        } else if (identifier.length === LENGTH_OF_GROUP_ID) {
            return 'group_channel_group_id';
        }
        return 'error';
    }

    return 'error';
}

export function goToChannelByChannelId(match: Match, history: History): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {team, identifier} = match.params;
        const channelId = identifier.toLowerCase();

        let channel = getChannel(state, channelId);
        const member = state.entities.channels.myMembers[channelId];
        const teamObj = getTeamByName(state, team);
        if (!channel || !member) {
            const dispatchResult = await dispatch(joinChannel(getCurrentUserId(state), teamObj!.id, channelId, ''));
            if ('error' in dispatchResult) {
                await dispatch(fetchChannelsAndMembers(teamObj!.id));
                handleChannelJoinError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                return {data: undefined};
            }
            channel = dispatchResult.data!.channel;
        }

        if (channel.type === Constants.DM_CHANNEL) {
            dispatch(goToDirectChannelByUserId(match, history, Utils.getUserIdFromChannelId(channel.name, getCurrentUserId(state))));
        } else if (channel.type === Constants.GM_CHANNEL) {
            history.replace(`/${team}/messages/${channel.name}`);
        } else {
            history.replace(`/${team}/channels/${channel.name}`);
        }
        return {data: undefined};
    };
}

export function goToChannelByChannelName(match: Match, history: History): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {team, identifier} = match.params;
        const channelName = identifier.toLowerCase();

        const teamObj = getTeamByName(state, team);
        if (!teamObj) {
            return {data: undefined};
        }

        let channel = getChannelsNameMapInTeam(state, teamObj!.id)[channelName];
        if (!channel) {
            const getChannelDispatchResult = await dispatch(getChannelByNameAndTeamName(team, channelName, true));
            if ('data' in getChannelDispatchResult) {
                channel = getChannelDispatchResult.data!;
            }
        }

        let member;
        if (channel) {
            member = state.entities.channels.myMembers[channel.id];
            if (!member) {
                const membership = await dispatch(getChannelMember(channel.id, getCurrentUserId(state)));
                if ('data' in membership) {
                    member = membership.data;
                }
            }
        }

        if (!channel || !member) {
            if (channel?.type === Constants.PRIVATE_CHANNEL) {
                // Prompt system admins and team admins before joining the private channel
                const user = getCurrentUser(getState());
                const isSystemAdmin = UserUtils.isSystemAdmin(user?.roles);
                let prompt = false;
                if (isSystemAdmin) {
                    prompt = true;
                } else {
                    const teamMember = getMyTeamMember(state, teamObj.id);
                    prompt = Boolean(teamMember && teamMember.scheme_admin);
                }
                if (prompt) {
                    const joinPromptResult = await dispatch(joinPrivateChannelPrompt(teamObj, channel.display_name));
                    if ('data' in joinPromptResult && !joinPromptResult.data!.join) {
                        return {data: undefined};
                    }
                }
            }

            const joinChannelDispatchResult = await dispatch(joinChannel(getCurrentUserId(state), teamObj!.id, channel?.id || '', channelName));
            if ('error' in joinChannelDispatchResult) {
                if (!channel) {
                    const getChannelDispatchResult = await dispatch(getChannelByNameAndTeamName(team, channelName, true));
                    if ('error' in getChannelDispatchResult || getChannelDispatchResult.data!.delete_at === 0) {
                        await dispatch(fetchChannelsAndMembers(teamObj!.id));
                        handleChannelJoinError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                        return {data: undefined};
                    }
                    channel = getChannelDispatchResult.data!;
                }
            } else {
                channel = joinChannelDispatchResult.data!.channel;
            }
        }

        if (channel.type === Constants.DM_CHANNEL) {
            dispatch(goToDirectChannelByUserIds(match, history));
        } else if (channel.type === Constants.GM_CHANNEL) {
            history.replace(`/${team}/messages/${channel.name}`);
        } else {
            doChannelChange(channel);
        }
        return {data: undefined};
    };
}

function goToDirectChannelByUsername(match: Match, history: History): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {team, identifier} = match.params;
        const username = identifier.slice(1, identifier.length).toLowerCase();
        const teamObj = getTeamByName(state, team);

        let user = selectUserByUsername(state, username);
        if (!user) {
            const dispatchResult = await dispatch(getUserByUsername(username));
            if ('error' in dispatchResult) {
                await dispatch(fetchChannelsAndMembers(teamObj!.id));
                handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                return {data: undefined};
            }
            user = dispatchResult.data!;
        }

        const directChannelDispatchRes = await dispatch(openDirectChannelToUserId(user.id));
        if ('error' in directChannelDispatchRes) {
            await dispatch(fetchChannelsAndMembers(teamObj!.id));
            handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
            return {data: undefined};
        }

        doChannelChange(directChannelDispatchRes.data!);
        return {data: undefined};
    };
}

export function goToDirectChannelByUserId(match: Match, history: History, userId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {team} = match.params;
        const teamObj = getTeamByName(state, team);

        let user = selectUser(state, userId);
        if (!user) {
            const dispatchResult = await dispatch(getUser(userId));
            if ('error' in dispatchResult) {
                await dispatch(fetchChannelsAndMembers(teamObj!.id));
                handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                return {data: undefined};
            }
            user = dispatchResult.data!;
        }

        history.replace(`/${team}/messages/@${user.username}`);
        return {data: undefined};
    };
}

export function goToDirectChannelByUserIds(match: Match, history: History): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {team, identifier} = match.params;
        const userId = Utils.getUserIdFromChannelId(identifier.toLowerCase(), getCurrentUserId(getState()));
        const teamObj = getTeamByName(state, team);

        let user = selectUser(state, userId);
        if (!user) {
            const dispatchResult = await dispatch(getUser(userId));
            if ('error' in dispatchResult) {
                await dispatch(fetchChannelsAndMembers(teamObj!.id));
                handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                return {data: undefined};
            }
            user = dispatchResult.data!;
        }

        history.replace(`/${team}/messages/@${user.username}`);
        return {data: undefined};
    };
}

export function goToDirectChannelByEmail(match: Match, history: History): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {team, identifier} = match.params;
        const email = identifier.toLowerCase();
        const teamObj = getTeamByName(state, team);

        let user = selectUserByEmail(state, email);
        if (!user) {
            const dispatchResult = await dispatch(getUserByEmail(email));
            if ('error' in dispatchResult) {
                await dispatch(fetchChannelsAndMembers(teamObj!.id));
                handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                return {data: undefined};
            }
            user = dispatchResult.data!;
        }

        history.replace(`/${team}/messages/@${user.username}`);
        return {data: undefined};
    };
}

function goToGroupChannelByGroupId(match: Match, history: History): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const {identifier, team} = match.params;
        const groupId = identifier.toLowerCase();

        history.replace(match.url.replace('/channels/', '/messages/'));

        let channel = getChannelByName(state, groupId);
        const teamObj = getTeamByName(state, team);
        if (!channel) {
            const dispatchResult = await dispatch(joinChannel(getCurrentUserId(state), teamObj!.id, '', groupId));
            if ('error' in dispatchResult) {
                await dispatch(fetchChannelsAndMembers(teamObj!.id));
                handleError(match, history, getRedirectChannelNameForTeam(state, teamObj!.id));
                return {data: undefined};
            }
            channel = dispatchResult.data!.channel;
        }

        dispatch(markGroupChannelOpen(channel!.id));

        doChannelChange(channel!);
        return {data: undefined};
    };
}

function doChannelChange(channel: Channel) {
    GlobalActions.emitChannelClickEvent(channel);
}

function handleError(match: Match, history: History, defaultChannel: string) {
    const {team} = match.params;
    history.push(team ? `/${team}/channels/${defaultChannel}` : '/');
}

function isDirectChannelIdentifier(identifier: string) {
    return identifier.length === LENGTH_OF_USER_ID_PAIR && USER_ID_PAIR_REGEXP.test(identifier);
}

async function handleChannelJoinError(match: Match, history: History, defaultChannel: string) {
    const {team} = match.params;
    history.push(team ? `/error?type=channel_not_found&returnTo=/${team}/channels/${defaultChannel}` : '/');
}
