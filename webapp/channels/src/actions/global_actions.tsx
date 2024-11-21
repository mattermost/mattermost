// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAppBindings} from 'mattermost-redux/actions/apps';
import {
    fetchChannelsAndMembers,
    getChannelByNameAndTeamName,
    getChannelStats,
    selectChannel,
} from 'mattermost-redux/actions/channels';
import {fetchTeamScheduledPosts} from 'mattermost-redux/actions/scheduled_posts';
import {logout, loadMe} from 'mattermost-redux/actions/users';
import {Preferences} from 'mattermost-redux/constants';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getCurrentChannelStats, getCurrentChannelId, getMyChannelMember, getRedirectChannelNameForTeam, getChannelsNameMapInTeam, getAllDirectChannels, getChannelMessageCount} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool, getIsOnboardingFlowEnabled, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeams, getTeam, getMyTeamMember, getTeamMemberships, getActiveTeamsList} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser, getCurrentUserId, isFirstAdmin} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';
import {calculateUnreadCount} from 'mattermost-redux/utils/channel_utils';

import {handleNewPost} from 'actions/post_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {clearUserCookie} from 'actions/views/cookie';
import {close as closeLhs} from 'actions/views/lhs';
import {closeRightHandSide, closeMenu as closeRhsMenu, updateRhsState} from 'actions/views/rhs';
import * as WebsocketActions from 'actions/websocket_actions.jsx';
import {getCurrentLocale} from 'selectors/i18n';
import {getIsRhsOpen, getPreviousRhsState, getRhsState} from 'selectors/rhs';
import BrowserStore from 'stores/browser_store';
import LocalStorageStore from 'stores/local_storage_store';
import store from 'stores/redux_store';

import SubMenuModal from 'components/widgets/menu/menu_modals/submenu_modal/submenu_modal';

import WebSocketClient from 'client/web_websocket_client';
import {getHistory} from 'utils/browser_history';
import {ActionTypes, PostTypes, RHSStates, ModalIdentifiers, PreviousViewedTypes} from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {openModal} from './views/modals';

const dispatch = store.dispatch;
const getState = store.getState;

export function emitChannelClickEvent(channel: Channel) {
    function switchToChannel(chan: Channel) {
        const state = getState();
        const userId = getCurrentUserId(state);
        const teamId = chan.team_id || getCurrentTeamId(state);
        const isRHSOpened = getIsRhsOpen(state);
        const isPinnedPostsShowing = getRhsState(state) === RHSStates.PIN;
        const isChannelFilesShowing = getRhsState(state) === RHSStates.CHANNEL_FILES;
        const member = getMyChannelMember(state, chan.id);
        const currentChannelId = getCurrentChannelId(state);
        const previousRhsState = getPreviousRhsState(state);

        dispatch(getChannelStats(chan.id));

        const penultimate = LocalStorageStore.getPreviousChannelName(userId, teamId);
        const penultimateType = LocalStorageStore.getPreviousViewedType(userId, teamId);
        if (penultimate !== chan.name) {
            LocalStorageStore.setPenultimateChannelName(userId, teamId, penultimate);
            LocalStorageStore.setPreviousChannelName(userId, teamId, chan.name);
        }

        if (penultimateType !== PreviousViewedTypes.CHANNELS || penultimate !== chan.name) {
            LocalStorageStore.setPreviousViewedType(userId, teamId, PreviousViewedTypes.CHANNELS);
            LocalStorageStore.setPenultimateViewedType(userId, teamId, penultimateType);
        }

        // When switching to a different channel if the pinned posts is showing
        // Update the RHS state to reflect the pinned post of the selected channel
        if (isRHSOpened && isPinnedPostsShowing) {
            dispatch(updateRhsState(RHSStates.PIN, chan.id, previousRhsState));
        }

        if (isRHSOpened && isChannelFilesShowing) {
            dispatch(updateRhsState(RHSStates.CHANNEL_FILES, chan.id, previousRhsState));
        }

        if (currentChannelId) {
            loadProfilesForSidebar();
        }

        dispatch(batchActions([
            {
                type: ChannelTypes.SELECT_CHANNEL,
                data: chan.id,
            },
            {
                type: ActionTypes.SELECT_CHANNEL_WITH_MEMBER,
                data: chan.id,
                channel: chan,
                member: member || {},
            },
            setLastUnreadChannel(state, chan),
        ]));

        if (appsEnabled(state)) {
            dispatch(fetchAppBindings(chan.id));
        }
    }

    switchToChannel(channel);
}

function setLastUnreadChannel(state: GlobalState, channel: Channel) {
    const member = getMyChannelMember(state, channel.id);
    const messageCount = getChannelMessageCount(state, channel.id);

    let hadMentions = false;
    let hadUnreads = false;
    if (member && messageCount) {
        const crtEnabled = isCollapsedThreadsEnabled(state);

        const unreadCount = calculateUnreadCount(messageCount, member, crtEnabled);

        hadMentions = unreadCount.mentions > 0;
        hadUnreads = unreadCount.showUnread && unreadCount.messages > 0;
    }

    return {
        type: ActionTypes.SET_LAST_UNREAD_CHANNEL,
        channelId: channel.id,
        hadMentions,
        hadUnreads,
    };
}

export const clearLastUnreadChannel = {
    type: ActionTypes.SET_LAST_UNREAD_CHANNEL,
    channelId: '',
};

export function updateNewMessagesAtInChannel(channelId: string, lastViewedAt = Date.now()) {
    return {
        type: ActionTypes.UPDATE_CHANNEL_LAST_VIEWED_AT,
        channel_id: channelId,
        last_viewed_at: lastViewedAt,
    };
}

export function emitCloseRightHandSide() {
    dispatch(closeRightHandSide());
}

export function showMobileSubMenuModal(elements: any[]) { // TODO Use more specific type
    const submenuModalData = {
        modalId: ModalIdentifiers.MOBILE_SUBMENU,
        dialogType: SubMenuModal,
        dialogProps: {
            elements,
        },
    };

    dispatch(openModal(submenuModalData));
}

export function sendEphemeralPost(message: string, channelId?: string, parentId?: string, userId?: string): ActionFuncAsync<boolean, GlobalState> {
    return (doDispatch, doGetState) => {
        const timestamp = Utils.getTimestamp();
        const post = {
            id: Utils.generateId(),
            user_id: userId || '0',
            channel_id: channelId || getCurrentChannelId(doGetState()),
            message,
            type: PostTypes.EPHEMERAL,
            create_at: timestamp,
            update_at: timestamp,
            root_id: parentId || '',
            props: {},
        } as Post;

        return doDispatch(handleNewPost(post));
    };
}

export function sendAddToChannelEphemeralPost(user: UserProfile, addedUsername: string, addedUserId: string, channelId: string, postRootId = '', timestamp: number) {
    const post = {
        id: Utils.generateId(),
        user_id: user.id,
        channel_id: channelId || getCurrentChannelId(getState()),
        message: '',
        type: PostTypes.EPHEMERAL_ADD_TO_CHANNEL,
        create_at: timestamp,
        update_at: timestamp,
        root_id: postRootId,
        props: {
            username: user.username,
            addedUsername,
            addedUserId,
        },
    } as unknown as Post;

    dispatch(handleNewPost(post));
}

let lastTimeTypingSent = 0;
export function emitLocalUserTypingEvent(channelId: string, parentPostId: string) {
    const userTyping: ActionFuncAsync = async (actionDispatch, actionGetState) => {
        const state = actionGetState();
        const config = getConfig(state);

        if (
            isPerformanceDebuggingEnabled(state) &&
            getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_TYPING_MESSAGES)
        ) {
            return {data: false};
        }

        const t = Date.now();
        const stats = getCurrentChannelStats(state);
        const membersInChannel = stats ? stats.member_count : 0;

        const timeBetweenUserTypingUpdatesMilliseconds = Utils.stringToNumber(config.TimeBetweenUserTypingUpdatesMilliseconds);
        const maxNotificationsPerChannel = Utils.stringToNumber(config.MaxNotificationsPerChannel);

        if (((t - lastTimeTypingSent) > timeBetweenUserTypingUpdatesMilliseconds) &&
            (membersInChannel < maxNotificationsPerChannel) && (config.EnableUserTypingMessages === 'true')) {
            WebSocketClient.userTyping(channelId, parentPostId);
            lastTimeTypingSent = t;
        }

        return {data: true};
    };

    return dispatch(userTyping);
}

export function emitUserLoggedOutEvent(redirectTo = '/', shouldSignalLogout = true, userAction = true) {
    // If the logout was intentional, discard knowledge about having previously been logged in.
    // This bit is otherwise used to detect session expirations on the login page.
    if (userAction) {
        LocalStorageStore.setWasLoggedIn(false);
    }

    dispatch(logout()).then(() => {
        if (shouldSignalLogout) {
            BrowserStore.signalLogout();
            DesktopApp.signalLogout();
        }

        BrowserStore.clearHideNotificationPermissionRequestBanner();

        WebsocketActions.close();

        clearUserCookie();

        getHistory().push(redirectTo);
    }).catch(() => {
        getHistory().push(redirectTo);
    });
}

export function toggleSideBarRightMenuAction(): ThunkActionFunc<void> {
    return (doDispatch) => {
        doDispatch(closeRightHandSide());
        doDispatch(closeLhs());
        doDispatch(closeRhsMenu());
    };
}

export function emitBrowserFocus(focus: boolean) {
    dispatch({
        type: ActionTypes.BROWSER_CHANGE_FOCUS,
        focus,
    });
}

export async function getTeamRedirectChannelIfIsAccesible(user: UserProfile, team: Team) {
    let state = getState();
    let channel = null;

    const myMember = getMyTeamMember(state, team.id);
    if (!myMember || Object.keys(myMember).length === 0) {
        return null;
    }

    let teamChannels = getChannelsNameMapInTeam(state, team.id);
    if (!teamChannels || Object.keys(teamChannels).length === 0) {
        // This should be executed in pretty limited scenarios (empty teams)
        await dispatch(fetchChannelsAndMembers(team.id)); // eslint-disable-line no-await-in-loop
        state = getState();
        teamChannels = getChannelsNameMapInTeam(state, team.id);
    }

    const channelName = LocalStorageStore.getPreviousChannelName(user.id, team.id);
    channel = teamChannels[channelName];

    if (typeof channel === 'undefined') {
        const dmList = getAllDirectChannels(state);
        channel = dmList.find((directChannel) => directChannel.name === channelName);
    }

    let channelMember: ChannelMembership | undefined;
    if (channel) {
        channelMember = getMyChannelMember(state, channel.id);
    }

    if (!channel || !channelMember) {
        // This should be executed in pretty limited scenarios (when the last visited channel in the team has been removed)
        await dispatch(getChannelByNameAndTeamName(team.name, channelName)); // eslint-disable-line no-await-in-loop
        state = getState();
        teamChannels = getChannelsNameMapInTeam(state, team.id);
        channel = teamChannels[channelName];
        channelMember = getMyChannelMember(state, channel && channel.id);
    }

    if (!channel || !channelMember) {
        const redirectedChannelName = getRedirectChannelNameForTeam(state, team.id);
        channel = teamChannels[redirectedChannelName];
        channelMember = getMyChannelMember(state, channel && channel.id);
    }

    if (channel && channelMember) {
        return channel;
    }
    return null;
}

function historyPushWithQueryParams(path: string, queryParams?: URLSearchParams) {
    if (queryParams) {
        getHistory().push({
            pathname: path,
            search: queryParams.toString(),
        });
    } else {
        getHistory().push(path);
    }
}

export async function redirectUserToDefaultTeam(searchParams?: URLSearchParams) {
    let state = getState();

    // Assume we need to load the user if they don't have any team memberships loaded or the user loaded
    let user = getCurrentUser(state);
    const shouldLoadUser = Utils.isEmptyObject(getTeamMemberships(state)) || !user;
    const onboardingFlowEnabled = getIsOnboardingFlowEnabled(state);
    if (shouldLoadUser) {
        await dispatch(loadMe());
        state = getState();
        user = getCurrentUser(state);
    }

    if (!user) {
        return;
    }

    // if the user is the first admin
    const isUserFirstAdmin = isFirstAdmin(state);

    const locale = getCurrentLocale(state);
    const teamId = LocalStorageStore.getPreviousTeamId(user.id);

    let myTeams = getMyTeams(state);
    const teams = getActiveTeamsList(state);
    if (teams.length === 0) {
        if (isUserFirstAdmin && onboardingFlowEnabled) {
            historyPushWithQueryParams('/preparing-workspace', searchParams);
            return;
        }

        historyPushWithQueryParams('/select_team', searchParams);
        return;
    }

    let team: Team | undefined;
    if (teamId) {
        team = getTeam(state, teamId);
    }

    if (team && team.delete_at === 0) {
        const channel = await getTeamRedirectChannelIfIsAccesible(user, team);
        if (channel) {
            dispatch(fetchTeamScheduledPosts(team.id, true));
            dispatch(selectChannel(channel.id));
            historyPushWithQueryParams(`/${team.name}/channels/${channel.name}`, searchParams);
            return;
        }
    }

    myTeams = filterAndSortTeamsByDisplayName(myTeams, locale);

    for (const myTeam of myTeams) {
        // This should execute async behavior in a pretty limited set of situations, so shouldn't be a problem
        const channel = await getTeamRedirectChannelIfIsAccesible(user, myTeam); // eslint-disable-line no-await-in-loop
        if (channel) {
            dispatch(selectChannel(channel.id));
            historyPushWithQueryParams(`/${myTeam.name}/channels/${channel.name}`, searchParams);
            return;
        }
    }

    historyPushWithQueryParams('/select_team', searchParams);
}
