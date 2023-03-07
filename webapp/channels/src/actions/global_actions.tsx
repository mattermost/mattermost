// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {
    fetchMyChannelsAndMembersREST,
    getChannelByNameAndTeamName,
    getChannelStats,
    selectChannel,
} from 'mattermost-redux/actions/channels';
import {logout, loadMe, loadMeREST} from 'mattermost-redux/actions/users';
import {Preferences} from 'mattermost-redux/constants';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId, getMyTeams, getTeam, getMyTeamMember, getTeamMemberships} from 'mattermost-redux/selectors/entities/teams';
import {getBool, isCollapsedThreadsEnabled, isGraphQLEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannelStats, getCurrentChannelId, getMyChannelMember, getRedirectChannelNameForTeam, getChannelsNameMapInTeam, getAllDirectChannels, getChannelMessageCount} from 'mattermost-redux/selectors/entities/channels';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAppBindings} from 'mattermost-redux/actions/apps';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {Post} from '@mattermost/types/posts';
import {ActionFunc, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {Team} from '@mattermost/types/teams';
import {calculateUnreadCount} from 'mattermost-redux/utils/channel_utils';

import {getHistory} from 'utils/browser_history';
import {handleNewPost} from 'actions/post_actions';
import {stopPeriodicStatusUpdates} from 'actions/status_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {closeRightHandSide, closeMenu as closeRhsMenu, updateRhsState} from 'actions/views/rhs';
import {clearUserCookie} from 'actions/views/cookie';
import {close as closeLhs} from 'actions/views/lhs';
import * as WebsocketActions from 'actions/websocket_actions.jsx';
import {getCurrentLocale} from 'selectors/i18n';
import {getIsRhsOpen, getPreviousRhsState, getRhsState} from 'selectors/rhs';
import BrowserStore from 'stores/browser_store';
import store from 'stores/redux_store.jsx';
import LocalStorageStore from 'stores/local_storage_store';
import WebSocketClient from 'client/web_websocket_client.jsx';

import {GlobalState} from 'types/store';

import {ActionTypes, PostTypes, RHSStates, ModalIdentifiers, PreviousViewedTypes} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';
import * as Utils from 'utils/utils';
import SubMenuModal from '../components/widgets/menu/menu_modals/submenu_modal/submenu_modal';

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

export function sendEphemeralPost(message: string, channelId?: string, parentId?: string, userId?: string): ActionFunc {
    return (doDispatch: DispatchFunc, doGetState: GetStateFunc) => {
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

export function sendGenericPostMessage(message: string, channelId?: string, parentId?: string, userId?: string): ActionFunc {
    return (doDispatch: DispatchFunc, doGetState: GetStateFunc) => {
        const timestamp = Utils.getTimestamp();
        const post = {
            id: Utils.generateId(),
            user_id: userId || '0',
            channel_id: channelId || getCurrentChannelId(doGetState()),
            message,
            type: PostTypes.SYSTEM_GENERIC,
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
    const userTyping = async (actionDispatch: DispatchFunc, actionGetState: GetStateFunc) => {
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
        }

        stopPeriodicStatusUpdates();
        WebsocketActions.close();

        clearUserCookie();

        getHistory().push(redirectTo);
    }).catch(() => {
        getHistory().push(redirectTo);
    });
}

export function toggleSideBarRightMenuAction() {
    return (doDispatch: DispatchFunc) => {
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
        await dispatch(fetchMyChannelsAndMembersREST(team.id)); // eslint-disable-line no-await-in-loop
        state = getState();
        teamChannels = getChannelsNameMapInTeam(state, team.id);
    }

    const channelName = LocalStorageStore.getPreviousChannelName(user.id, team.id);
    channel = teamChannels[channelName];

    if (typeof channel === 'undefined') {
        const dmList = getAllDirectChannels(state);
        channel = dmList.find((directChannel) => directChannel.name === channelName);
    }

    let channelMember: ChannelMembership | null | undefined;
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

export async function redirectUserToDefaultTeam() {
    let state = getState();

    // Assume we need to load the user if they don't have any team memberships loaded or the user loaded
    let user = getCurrentUser(state);
    const shouldLoadUser = Utils.isEmptyObject(getTeamMemberships(state)) || !user;

    if (shouldLoadUser) {
        if (isGraphQLEnabled(state)) {
            await dispatch(loadMe());
        } else {
            await dispatch(loadMeREST());
        }
        state = getState();
        user = getCurrentUser(state);
    }

    if (!user) {
        return;
    }

    const locale = getCurrentLocale(state);
    const teamId = LocalStorageStore.getPreviousTeamId(user.id);

    let myTeams = getMyTeams(state);
    if (myTeams.length === 0) {
        getHistory().push('/select_team');
        return;
    }

    let team: Team | undefined;
    if (teamId) {
        team = getTeam(state, teamId);
    }

    if (team && team.delete_at === 0) {
        const channel = await getTeamRedirectChannelIfIsAccesible(user, team);
        if (channel) {
            dispatch(selectChannel(channel.id));
            getHistory().push(`/${team.name}/channels/${channel.name}`);
            return;
        }
    }

    myTeams = filterAndSortTeamsByDisplayName(myTeams, locale);

    for (const myTeam of myTeams) {
        // This should execute async behavior in a pretty limited set of situations, so shouldn't be a problem
        const channel = await getTeamRedirectChannelIfIsAccesible(user, myTeam); // eslint-disable-line no-await-in-loop
        if (channel) {
            dispatch(selectChannel(channel.id));
            getHistory().push(`/${myTeam.name}/channels/${channel.name}`);
            return;
        }
    }

    getHistory().push('/select_team');
}
