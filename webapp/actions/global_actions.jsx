// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import SearchStore from 'stores/search_store.jsx';

import {handleNewPost} from 'actions/post_actions.jsx';
import {loadProfilesForSidebar} from 'actions/user_actions.jsx';
import {loadChannelsForCurrentUser} from 'actions/channel_actions.jsx';
import {stopPeriodicStatusUpdates} from 'actions/status_actions.jsx';
import * as WebsocketActions from 'actions/websocket_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import EventTypes from 'utils/event_types.jsx';

import WebSocketClient from 'client/web_websocket_client.jsx';
import {sortTeamsByDisplayName} from 'utils/team_utils.jsx';
import * as Utils from 'utils/utils.jsx';

import en from 'i18n/en.json';
import * as I18n from 'i18n/i18n.jsx';
import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {Client4} from 'mattermost-redux/client';

import {removeUserFromTeam} from 'mattermost-redux/actions/teams';
import {viewChannel, getChannelStats, getMyChannelMember, getChannelAndMyMember, createDirectChannel, joinChannel} from 'mattermost-redux/actions/channels';
import {getPostThread} from 'mattermost-redux/actions/posts';

export function emitChannelClickEvent(channel) {
    function userVisitedFakeChannel(chan, success, fail) {
        const currentUserId = UserStore.getCurrentId();
        const otherUserId = Utils.getUserIdFromChannelName(chan);
        createDirectChannel(currentUserId, otherUserId)(dispatch, getState).then(
            (result) => {
                const receivedChannel = result.data;

                if (receivedChannel) {
                    success(receivedChannel);
                } else {
                    fail();
                }
            }
        );
    }
    function switchToChannel(chan) {
        const channelMember = ChannelStore.getMyMember(chan.id);
        const getMyChannelMemberPromise = getMyChannelMember(chan.id)(dispatch, getState);
        const oldChannelId = ChannelStore.getCurrentId();

        getMyChannelMemberPromise.then(() => {
            getChannelStats(chan.id)(dispatch, getState);
            viewChannel(chan.id, oldChannelId)(dispatch, getState);

            // Mark previous and next channel as read
            ChannelStore.resetCounts([chan.id, oldChannelId]);
            reloadIfServerVersionChanged();
        });

        // Subtract mentions for the team
        const {msgs, mentions} = ChannelStore.getUnreadCounts()[chan.id] || {msgs: 0, mentions: 0};
        TeamStore.subtractUnread(chan.team_id, msgs, mentions);

        BrowserStore.setGlobalItem(chan.team_id, chan.id);

        loadProfilesForSidebar();

        AppDispatcher.handleViewAction({
            type: ActionTypes.CLICK_CHANNEL,
            name: chan.name,
            id: chan.id,
            team_id: chan.team_id,
            total_msg_count: chan.total_msg_count,
            channelMember,
            prev: oldChannelId
        });
    }

    if (channel.fake) {
        userVisitedFakeChannel(
            channel,
            (data) => {
                switchToChannel(data);
            },
            () => {
                browserHistory.push('/' + this.state.currentTeam.name);
            }
        );
    } else {
        switchToChannel(channel);
    }
}

export async function doFocusPost(channelId, postId, data) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_FOCUSED_POST,
        postId,
        channelId,
        post_list: data
    });

    dispatch({
        type: ActionTypes.RECEIVED_FOCUSED_POST,
        data: postId,
        channelId
    });

    const member = getState().entities.channels.myMembers[channelId];
    if (member == null) {
        await joinChannel(UserStore.getCurrentId(), null, channelId)(dispatch, getState);
    }

    loadChannelsForCurrentUser();
    getChannelStats(channelId)(dispatch, getState);
}

export function emitPostFocusEvent(postId, onSuccess) {
    loadChannelsForCurrentUser();
    getPostThread(postId)(dispatch, getState).then(
        (data) => {
            if (data) {
                const channelId = data.posts[data.order[0]].channel_id;
                doFocusPost(channelId, postId, data).then(() => {
                    if (onSuccess) {
                        onSuccess();
                    }
                });
            } else {
                let link = `${TeamStore.getCurrentTeamRelativeUrl()}/channels/`;
                const channel = ChannelStore.getCurrent();
                if (channel) {
                    link += channel.name;
                } else {
                    link += 'town-square';
                }

                const message = encodeURIComponent(Utils.localizeMessage('permalink.error.access', 'Permalink belongs to a deleted message or to a channel to which you do not have access.'));
                const title = encodeURIComponent(Utils.localizeMessage('permalink.error.title', 'Message Not Found'));

                browserHistory.push('/error?message=' + message + '&title=' + title + '&link=' + encodeURIComponent(link));
            }
        }
    );
}

export function emitCloseRightHandSide() {
    SearchStore.storeSearchResults(null, false, false);
    SearchStore.emitSearchChange();

    dispatch({
        type: ActionTypes.SELECT_POST,
        postId: ''
    });
}

export function emitPostFocusRightHandSideFromSearch(post, isMentionSearch) {
    getPostThread(post.id)(dispatch, getState).then(
        () => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: Utils.getRootId(post),
                from_search: SearchStore.getSearchTerm(),
                from_flagged_posts: SearchStore.getIsFlaggedPosts(),
                from_pinned_posts: SearchStore.getIsPinnedPosts()
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: null,
                is_mention_search: isMentionSearch
            });
        }
    );
}

export function emitLeaveTeam() {
    removeUserFromTeam(TeamStore.getCurrentId(), UserStore.getCurrentId())(dispatch, getState);
}

export function emitUserPostedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.CREATE_POST,
        post
    });
}

export function emitUserCommentedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.CREATE_COMMENT,
        post
    });
}

export function showAccountSettingsModal() {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_ACCOUNT_SETTINGS_MODAL,
        value: true
    });
}

export function showDeletePostModal(post, commentCount = 0) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_DELETE_POST_MODAL,
        value: true,
        post,
        commentCount
    });
}

export function showChannelHeaderUpdateModal(channel) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_CHANNEL_HEADER_UPDATE_MODAL,
        value: true,
        channel
    });
}

export function showChannelPurposeUpdateModal(channel) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_CHANNEL_PURPOSE_UPDATE_MODAL,
        value: true,
        channel
    });
}

export function showChannelNameUpdateModal(channel) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_CHANNEL_NAME_UPDATE_MODAL,
        value: true,
        channel
    });
}

export function showGetPostLinkModal(post) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_GET_POST_LINK_MODAL,
        value: true,
        post
    });
}

export function showGetPublicLinkModal(fileId) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_GET_PUBLIC_LINK_MODAL,
        value: true,
        fileId
    });
}

export function showGetTeamInviteLinkModal() {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.TOGGLE_GET_TEAM_INVITE_LINK_MODAL,
        value: true
    });
}

export function showInviteMemberModal() {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_INVITE_MEMBER_MODAL,
        value: true
    });
}

export function showLeaveTeamModal() {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_LEAVE_TEAM_MODAL,
        value: true
    });
}

export function showLeavePrivateChannelModal(channel) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_LEAVE_PRIVATE_CHANNEL_MODAL,
        value: channel
    });
}

export function emitSuggestionPretextChanged(suggestionId, pretext) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.SUGGESTION_PRETEXT_CHANGED,
        id: suggestionId,
        pretext
    });
}

export function emitSelectNextSuggestion(suggestionId) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.SUGGESTION_SELECT_NEXT,
        id: suggestionId
    });
}

export function emitSelectPreviousSuggestion(suggestionId) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.SUGGESTION_SELECT_PREVIOUS,
        id: suggestionId
    });
}

export function emitCompleteWordSuggestion(suggestionId, term = '') {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.SUGGESTION_COMPLETE_WORD,
        id: suggestionId,
        term
    });
}

export function emitClearSuggestions(suggestionId) {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.SUGGESTION_CLEAR_SUGGESTIONS,
        id: suggestionId
    });
}

export function emitPreferenceChangedEvent(preference) {
    AppDispatcher.handleServerAction({
        type: Constants.ActionTypes.RECEIVED_PREFERENCE,
        preference
    });

    if (addedNewDmUser(preference)) {
        loadProfilesForSidebar();
    }
}

export function emitPreferencesChangedEvent(preferences) {
    AppDispatcher.handleServerAction({
        type: Constants.ActionTypes.RECEIVED_PREFERENCES,
        preferences
    });

    if (preferences.findIndex(addedNewDmUser) !== -1) {
        loadProfilesForSidebar();
    }
}

function addedNewDmUser(preference) {
    return preference.category === Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW && preference.value === 'true';
}

export function emitPreferencesDeletedEvent(preferences) {
    AppDispatcher.handleServerAction({
        type: Constants.ActionTypes.DELETED_PREFERENCES,
        preferences
    });
}

export function sendEphemeralPost(message, channelId, parentId) {
    const timestamp = Utils.getTimestamp();
    const post = {
        id: Utils.generateId(),
        user_id: '0',
        channel_id: channelId || ChannelStore.getCurrentId(),
        message,
        type: Constants.PostTypes.EPHEMERAL,
        create_at: timestamp,
        update_at: timestamp,
        root_id: parentId,
        parent_id: parentId,
        props: {}
    };

    handleNewPost(post);
}

export function newLocalizationSelected(locale) {
    const localeInfo = I18n.getLanguageInfo(locale);

    if (locale === 'en' || !localeInfo) {
        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_LOCALE,
            locale,
            translations: en
        });
    } else {
        Client4.getTranslations(localeInfo.url).then(
            (data, res) => {
                let translations = data;
                if (!data && res.text) {
                    translations = JSON.parse(res.text);
                }
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_LOCALE,
                    locale,
                    translations
                });
            }
        ).catch(
            () => {} //eslint-disable-line no-empty-function
        );
    }
}

export function loadCurrentLocale() {
    const user = UserStore.getCurrentUser();

    if (user && user.locale) {
        newLocalizationSelected(user.locale);
    } else {
        loadDefaultLocale();
    }
}

export function loadDefaultLocale() {
    let locale = global.window.mm_config.DefaultClientLocale;

    if (!I18n.getLanguageInfo(locale)) {
        locale = 'en';
    }

    return newLocalizationSelected(locale);
}

let lastTimeTypingSent = 0;
export function emitLocalUserTypingEvent(channelId, parentId) {
    const t = Date.now();
    const membersInChannel = ChannelStore.getStats(channelId).member_count;

    if (((t - lastTimeTypingSent) > global.window.mm_config.TimeBetweenUserTypingUpdatesMilliseconds) && membersInChannel < global.window.mm_config.MaxNotificationsPerChannel && global.window.mm_config.EnableUserTypingMessages === 'true') {
        WebSocketClient.userTyping(channelId, parentId);
        lastTimeTypingSent = t;
    }
}

export function emitRemoteUserTypingEvent(channelId, userId, postParentId) {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.USER_TYPING,
        channelId,
        userId,
        postParentId
    });
}

export function emitUserLoggedOutEvent(redirectTo = '/', shouldSignalLogout = true) {
    Client4.logout().then(
        () => {
            if (shouldSignalLogout) {
                BrowserStore.signalLogout();
            }

            clientLogout(redirectTo);
        }
    ).catch(
        () => {
            browserHistory.push(redirectTo);
        }
    );
}

export function clientLogout(redirectTo = '/') {
    BrowserStore.clear();
    ErrorStore.clearLastError();
    ChannelStore.clear();
    stopPeriodicStatusUpdates();
    WebsocketActions.close();
    document.cookie = 'MMUSERID=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = redirectTo;
}

export function emitSearchMentionsEvent(user) {
    let terms = '';
    if (user.notify_props) {
        const termKeys = UserStore.getMentionKeys(user.id);

        if (termKeys.indexOf('@channel') !== -1) {
            termKeys[termKeys.indexOf('@channel')] = '';
        }

        if (termKeys.indexOf('@all') !== -1) {
            termKeys[termKeys.indexOf('@all')] = '';
        }

        terms = termKeys.join(' ');
    }

    trackEvent('api', 'api_posts_search_mention');

    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_SEARCH_TERM,
        term: terms,
        do_search: true,
        is_mention_search: true
    });
}

export function toggleSideBarAction(visible) {
    if (!visible) {
        //Array of actions resolving in the closing of the sidebar
        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH_TERM,
            term: null,
            do_search: false,
            is_mention_search: false
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_POST_SELECTED,
            postId: null
        });
    }
}

export function toggleSideBarRightMenuAction() {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_SEARCH,
        results: null
    });

    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_POST_SELECTED,
        postId: null
    });

    document.querySelector('.app__body .inner-wrap').classList.remove('move--right', 'move--left', 'move--left-small');
    document.querySelector('.app__body .sidebar--left').classList.remove('move--right');
    document.querySelector('.app__body .sidebar--right').classList.remove('move--left');
    document.querySelector('.app__body .sidebar--menu').classList.remove('move--left');
}

export function emitBrowserFocus(focus) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.BROWSER_CHANGE_FOCUS,
        focus
    });
}

export function redirectUserToDefaultTeam() {
    const teams = TeamStore.getAll();
    const teamMembers = TeamStore.getMyTeamMembers();
    let teamId = BrowserStore.getGlobalItem('team');

    function redirect(teamName, channelName) {
        browserHistory.push(`/${teamName}/channels/${channelName}`);
    }

    if (!teams[teamId] && teamMembers.length > 0) {
        let myTeams = [];
        for (const index in teamMembers) {
            if (teamMembers.hasOwnProperty(index)) {
                const teamMember = teamMembers[index];
                myTeams.push(teams[teamMember.team_id]);
            }
        }

        if (myTeams.length > 0) {
            myTeams = myTeams.sort(sortTeamsByDisplayName);
            teamId = myTeams[0].id;
        }
    }

    if (teams[teamId]) {
        const channelId = BrowserStore.getGlobalItem(teamId);
        const channel = ChannelStore.getChannelById(channelId);
        if (channel) {
            redirect(teams[teamId].name, channel);
        } else if (channelId) {
            getChannelAndMyMember(channelId)(dispatch, getState).then(
                (data) => {
                    if (data) {
                        redirect(teams[teamId].name, data.channel.name);
                    } else {
                        redirect(teams[teamId].name, 'town-square');
                    }
                }
            );
        } else {
            redirect(teams[teamId].name, 'town-square');
        }
    } else {
        browserHistory.push('/select_team');
    }
}

export function postListScrollChange(forceScrollToBottom = false) {
    AppDispatcher.handleViewAction({
        type: EventTypes.POST_LIST_SCROLL_CHANGE,
        value: forceScrollToBottom
    });
}

export function emitPopoverMentionKeyClick(isRHS, mentionKey) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.POPOVER_MENTION_KEY_CLICK,
        isRHS,
        mentionKey
    });
}

let serverVersion = '';

export function reloadIfServerVersionChanged() {
    const newServerVersion = Client4.getServerVersion();
    if (serverVersion && serverVersion !== newServerVersion) {
        console.log('Detected version update refreshing the page'); //eslint-disable-line no-console
        window.location.reload(true);
    }

    serverVersion = newServerVersion;
}
