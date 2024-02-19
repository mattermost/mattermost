// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PQueue from 'p-queue';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getChannelAndMyMember, getChannelMembersByIds} from 'mattermost-redux/actions/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getTeamMembersByIds} from 'mattermost-redux/actions/teams';
import * as UserActions from 'mattermost-redux/actions/users';
import {Preferences as PreferencesRedux, General} from 'mattermost-redux/constants';
import {
    getChannel,
    getChannelMembersInChannels,
    getChannelMessageCount,
    getCurrentChannelId,
    getMyChannelMember,
    getMyChannels,
} from 'mattermost-redux/selectors/entities/channels';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {getBool, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getTeamMember} from 'mattermost-redux/selectors/entities/teams';
import * as Selectors from 'mattermost-redux/selectors/entities/users';
import type {ActionResult, ActionFunc, ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';
import {calculateUnreadCount} from 'mattermost-redux/utils/channel_utils';

import {loadCustomEmojisForCustomStatusesByUserIds} from 'actions/emoji_actions';
import {loadStatusesForProfilesList, loadStatusesForProfilesMap} from 'actions/status_actions';
import {getDisplayedChannels} from 'selectors/views/channel_sidebar';
import store from 'stores/redux_store';

import {Constants, Preferences, UserStatuses} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

export const queue = new PQueue({concurrency: 4});
const dispatch = store.dispatch;
const getState = store.getState;

export function loadProfilesAndReloadTeamMembers(page: number, perPage: number, teamId: string, options = {}): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const newTeamId = teamId || getCurrentTeamId(doGetState());
        const {data} = await doDispatch(UserActions.getProfilesInTeam(newTeamId, page, perPage, '', options));
        if (data) {
            await Promise.all([
                doDispatch(loadTeamMembersForProfilesList(data, newTeamId, true)),
                doDispatch(loadStatusesForProfilesList(data)),
            ]);
        }

        return {data: true};
    };
}

export function loadProfilesAndReloadChannelMembers(page: number, perPage?: number, channelId?: string, sort = '', options = {}): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const newChannelId = channelId || getCurrentChannelId(doGetState());
        const {data} = await doDispatch(UserActions.getProfilesInChannel(newChannelId, page, perPage, sort, options));
        if (data) {
            await Promise.all([
                doDispatch(loadChannelMembersForProfilesList(data, newChannelId, true)),
                doDispatch(loadStatusesForProfilesList(data)),
            ]);
        }

        return {data: true};
    };
}

export function loadProfilesAndTeamMembers(page: number, perPage: number, teamId: string, options?: Record<string, any>): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const newTeamId = teamId || getCurrentTeamId(doGetState());
        const {data} = await doDispatch(UserActions.getProfilesInTeam(newTeamId, page, perPage, '', options));
        if (data) {
            doDispatch(loadTeamMembersForProfilesList(data, newTeamId));
            doDispatch(loadStatusesForProfilesList(data));
        }

        return {data: true};
    };
}

export function searchProfilesAndTeamMembers(term = '', options: Record<string, any> = {}): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const newTeamId = options.team_id || getCurrentTeamId(doGetState());
        const {data} = await doDispatch(UserActions.searchProfiles(term, options));
        if (data) {
            await Promise.all([
                doDispatch(loadTeamMembersForProfilesList(data, newTeamId)),
                doDispatch(loadStatusesForProfilesList(data)),
            ]);
        }

        return {data: true};
    };
}

export function searchProfilesAndChannelMembers(term: string, options: Record<string, any> = {}): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const newChannelId = options.in_channel_id || getCurrentChannelId(doGetState());
        const {data} = await doDispatch(UserActions.searchProfiles(term, options));
        if (data) {
            await Promise.all([
                doDispatch(loadChannelMembersForProfilesList(data, newChannelId)),
                doDispatch(loadStatusesForProfilesList(data)),
            ]);
        }

        return {data: true};
    };
}

export function loadProfilesAndTeamMembersAndChannelMembers(page: number, perPage: number, teamId: string, channelId: string, options?: {active?: boolean}): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const teamIdParam = teamId || getCurrentTeamId(state);
        const channelIdParam = channelId || getCurrentChannelId(state);
        const {data} = await doDispatch(UserActions.getProfilesInChannel(channelIdParam, page, perPage, '', options));
        if (data) {
            const {data: listData} = await doDispatch(loadTeamMembersForProfilesList(data, teamIdParam));
            if (listData) {
                doDispatch(loadChannelMembersForProfilesList(data, channelIdParam));
                doDispatch(loadStatusesForProfilesList(data));
            }
        }

        return {data: true};
    };
}

export function loadTeamMembersForProfilesList(profiles: UserProfile[], teamId: string, reloadAllMembers = false): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const teamIdParam = teamId || getCurrentTeamId(state);
        const membersToLoad: Record<string, true> = {};
        for (let i = 0; i < profiles.length; i++) {
            const pid = profiles[i].id;

            if (reloadAllMembers === true || !getTeamMember(state, teamIdParam, pid)) {
                membersToLoad[pid] = true;
            }
        }

        const userIdsToLoad = Object.keys(membersToLoad);
        if (userIdsToLoad.length === 0) {
            return {data: true};
        }

        await doDispatch(getTeamMembersByIds(teamIdParam, userIdsToLoad));

        return {data: true};
    };
}

export function loadProfilesWithoutTeam(page: number, perPage: number, options?: Record<string, any>): ActionFuncAsync {
    return async (doDispatch) => {
        const {data} = await doDispatch(UserActions.getProfilesWithoutTeam(page, perPage, options));

        doDispatch(loadStatusesForProfilesMap(data!));

        return {data};
    };
}

export function loadTeamMembersAndChannelMembersForProfilesList(profiles: UserProfile[], teamId: string, channelId: string): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const teamIdParam = teamId || getCurrentTeamId(state);
        const channelIdParam = channelId || getCurrentChannelId(state);
        const {data} = await doDispatch(loadTeamMembersForProfilesList(profiles, teamIdParam));
        if (data) {
            doDispatch(loadChannelMembersForProfilesList(profiles, channelIdParam));
        }

        return {data: true};
    };
}

export function loadChannelMembersForProfilesList(profiles: UserProfile[], channelId: string, reloadAllMembers = false): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const channelIdParam = channelId || getCurrentChannelId(state);
        const membersToLoad: Record<string, boolean> = {};
        for (let i = 0; i < profiles.length; i++) {
            const pid = profiles[i].id;

            const members = getChannelMembersInChannels(state)[channelIdParam];
            if (reloadAllMembers === true || !members || !members[pid]) {
                membersToLoad[pid] = true;
            }
        }

        const list = Object.keys(membersToLoad);
        if (list.length === 0) {
            return {data: true};
        }

        await doDispatch(getChannelMembersByIds(channelIdParam, list));
        return {data: true};
    };
}

export function loadNewDMIfNeeded(channelId: string): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = Selectors.getCurrentUserId(state);

        function checkPreference(channel: Channel) {
            const userId = Utils.getUserIdFromChannelName(channel);

            if (!userId) {
                return {data: false};
            }

            const pref = getBool(state, Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, false);
            if (pref === false) {
                const now = Utils.getTimestamp();
                doDispatch(savePreferences(currentUserId, [
                    {user_id: currentUserId, category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: userId, value: 'true'},
                    {user_id: currentUserId, category: Preferences.CATEGORY_CHANNEL_OPEN_TIME, name: channelId, value: now.toString()},
                ]));
                loadProfilesForDM();
                return {data: true};
            }
            return {data: false};
        }

        let result = {data: false} as ActionResult;

        const channel = getChannel(doGetState(), channelId);
        if (channel) {
            result = checkPreference(channel);
        } else {
            result = await doDispatch(getChannelAndMyMember(channelId));
            if (result.data) {
                result = checkPreference(result.data.channel);
            }
        }
        return result;
    };
}

export function loadNewGMIfNeeded(channelId: string): ActionFuncAsync {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = Selectors.getCurrentUserId(state);

        function checkPreference() {
            const pref = getBool(state, Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, false);
            if (pref === false) {
                dispatch(savePreferences(currentUserId, [{user_id: currentUserId, category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW, name: channelId, value: 'true'}]));
                loadProfilesForGM();
                return {data: true};
            }
            return {data: false};
        }

        const channel = getChannel(state, channelId);
        if (!channel) {
            await doDispatch(getChannelAndMyMember(channelId));
        }
        return checkPreference();
    };
}

export function loadProfilesForGroupChannels(groupChannels: Channel[]): ActionFunc {
    return (doDispatch, doGetState) => {
        const state = doGetState();
        const userIdsInChannels = Selectors.getUserIdsInChannels(state);

        const groupChannelsToFetch = groupChannels.reduce((acc, {id}) => {
            const userIdsInGroupChannel = (userIdsInChannels[id] || new Set());

            if (userIdsInGroupChannel.size === 0) {
                acc.push(id);
            }
            return acc;
        }, ([] as string[]));

        if (groupChannelsToFetch.length > 0) {
            doDispatch(UserActions.getProfilesInGroupChannels(groupChannelsToFetch));
            return {data: true};
        }

        return {data: false};
    };
}

export async function loadProfilesForSidebar() {
    await Promise.all([loadProfilesForDM(), loadProfilesForGM()]);
}

export const getGMsForLoading = (state: GlobalState) => {
    // Get all channels visible on the current team which doesn't include hidden GMs/DMs
    let channels = getDisplayedChannels(state);

    // Make sure we only have GMs
    channels = channels.filter((channel) => channel.type === General.GM_CHANNEL);

    return channels;
};

export async function loadProfilesForGM() {
    const state = getState();
    const newPreferences = [];
    const userIdsInChannels = Selectors.getUserIdsInChannels(state);
    const currentUserId = Selectors.getCurrentUserId(state);
    const collapsedThreads = isCollapsedThreadsEnabled(state);

    const userIdsForLoadingCustomEmojis = new Set();
    for (const channel of getGMsForLoading(state)) {
        const userIds = userIdsInChannels[channel.id] || new Set();

        userIds.forEach((userId) => userIdsForLoadingCustomEmojis.add(userId));

        if (userIds.size >= Constants.MIN_USERS_IN_GM) {
            continue;
        }

        const isVisible = getBool(state, Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channel.id);

        if (!isVisible) {
            const messageCount = getChannelMessageCount(state, channel.id);
            const member = getMyChannelMember(state, channel.id);

            const unreadCount = calculateUnreadCount(messageCount, member, collapsedThreads);

            if (!unreadCount.showUnread) {
                continue;
            }

            newPreferences.push({
                user_id: currentUserId,
                category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW,
                name: channel.id,
                value: 'true',
            });
        }

        const getProfilesAction = UserActions.getProfilesInChannel(channel.id, 0, Constants.MAX_USERS_IN_GM);
        queue.add(() => dispatch(getProfilesAction));
    }

    await queue.onEmpty();

    if (userIdsForLoadingCustomEmojis.size > 0) {
        dispatch(loadCustomEmojisForCustomStatusesByUserIds(userIdsForLoadingCustomEmojis));
    }
    if (newPreferences.length > 0) {
        dispatch(savePreferences(currentUserId, newPreferences));
    }
}

export async function loadProfilesForDM() {
    const state = getState();
    const channels = getMyChannels(state);
    const newPreferences = [];
    const profilesToLoad = [];
    const profileIds = [];
    const currentUserId = Selectors.getCurrentUserId(state);
    const collapsedThreads = isCollapsedThreadsEnabled(state);

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (channel.type !== Constants.DM_CHANNEL) {
            continue;
        }

        const teammateId = channel.name.replace(currentUserId, '').replace('__', '');
        const isVisible = getBool(state, Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammateId);

        if (!isVisible) {
            const member = getMyChannelMember(state, channel.id);
            const messageCount = getChannelMessageCount(state, channel.id);

            const unreadCount = calculateUnreadCount(messageCount, member, collapsedThreads);

            if (!member || !unreadCount.showUnread) {
                continue;
            }

            newPreferences.push({
                user_id: currentUserId,
                category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
                name: teammateId,
                value: 'true',
            });
        }

        if (!Selectors.getUser(state, teammateId)) {
            profilesToLoad.push(teammateId);
        }
        profileIds.push(teammateId);
    }

    if (newPreferences.length > 0) {
        dispatch(savePreferences(currentUserId, newPreferences));
    }

    if (profilesToLoad.length > 0) {
        await dispatch(UserActions.getProfilesByIds(profilesToLoad));
    }
    await dispatch(loadCustomEmojisForCustomStatusesByUserIds(profileIds));
}

export function autocompleteUsersInTeam(username: string): ThunkActionFunc<Promise<UserAutocomplete>> {
    return async (doDispatch, doGetState) => {
        const currentTeamId = getCurrentTeamId(doGetState());
        const {data} = await doDispatch(UserActions.autocompleteUsers(username, currentTeamId));
        return data!;
    };
}

export function autocompleteUsers(username: string): ThunkActionFunc<Promise<UserAutocomplete>> {
    return async (doDispatch) => {
        const {data} = await doDispatch(UserActions.autocompleteUsers(username));
        return data!;
    };
}

export function autoResetStatus(): ActionFuncAsync<UserStatus> {
    return async (doDispatch) => {
        const state = getState();
        const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);

        if (!enabledUserStatuses) {
            return {data: undefined};
        }

        const {currentUserId} = state.entities.users;
        const {data: userStatus} = await doDispatch(UserActions.getStatus(currentUserId));

        if (userStatus?.status === UserStatuses.OUT_OF_OFFICE || !userStatus?.manual) {
            return {data: userStatus};
        }

        const autoReset = getBool(getState(), PreferencesRedux.CATEGORY_AUTO_RESET_MANUAL_STATUS, currentUserId, false);

        if (autoReset) {
            doDispatch(UserActions.setStatus({user_id: currentUserId, status: 'online'}));
            return {data: userStatus};
        }

        return {data: userStatus};
    };
}
