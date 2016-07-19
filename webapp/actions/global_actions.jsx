// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import SearchStore from 'stores/search_store.jsx';

import {handleNewPost} from 'actions/post_actions.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import WebSocketClient from 'client/web_websocket_client.jsx';
import * as Utils from 'utils/utils.jsx';

import en from 'i18n/en.json';
import * as I18n from 'i18n/i18n.jsx';
import {trackPage} from 'actions/analytics_actions.jsx';
import {browserHistory} from 'react-router/es6';

export function emitChannelClickEvent(channel) {
    function userVisitedFakeChannel(chan, success, fail) {
        const otherUserId = Utils.getUserIdFromChannelName(chan);
        Client.createDirectChannel(
            otherUserId,
            (data) => {
                success(data);
            },
            () => {
                fail();
            }
        );
    }
    function switchToChannel(chan) {
        AsyncClient.getChannels(true);
        AsyncClient.getChannelExtraInfo(chan.id);
        AsyncClient.updateLastViewedAt(chan.id);
        AsyncClient.getPosts(chan.id);
        trackPage();

        AppDispatcher.handleViewAction({
            type: ActionTypes.CLICK_CHANNEL,
            name: chan.name,
            id: chan.id,
            prev: ChannelStore.getCurrentId()
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

export function emitInitialLoad(callback) {
    Client.getInitialLoad(
            (data) => {
                global.window.mm_config = data.client_cfg;
                global.window.mm_license = data.license_cfg;

                UserStore.setNoAccounts(data.no_accounts);

                if (data.user && data.user.id) {
                    global.window.mm_user = data.user;
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_ME,
                        me: data.user
                    });
                }

                if (data.preferences) {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_PREFERENCES,
                        preferences: data.preferences
                    });
                }

                if (data.teams) {
                    var teams = {};
                    data.teams.forEach((team) => {
                        teams[team.id] = team;
                    });

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_ALL_TEAMS,
                        teams
                    });
                }

                if (data.team_members) {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_TEAM_MEMBERS,
                        team_members: data.team_members
                    });
                }

                if (data.direct_profiles) {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_DIRECT_PROFILES,
                        profiles: data.direct_profiles
                    });
                }

                if (callback) {
                    callback();
                }
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getInitialLoad');

                if (callback) {
                    callback();
                }
            }
        );
}

export function doFocusPost(channelId, postId, data) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_FOCUSED_POST,
        postId,
        channelId,
        post_list: data
    });
    AsyncClient.getChannels(true);
    AsyncClient.getChannelExtraInfo(channelId);
    AsyncClient.getPostsBefore(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS, true);
    AsyncClient.getPostsAfter(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS, true);
}

export function emitPostFocusEvent(postId) {
    AsyncClient.getChannels(true);
    Client.getPermalinkTmp(
        postId,
        (data) => {
            if (!data) {
                return;
            }
            const channelId = data.posts[data.order[0]].channel_id;
            doFocusPost(channelId, postId, data);
        },
        () => {
            browserHistory.push('/error?message=' + encodeURIComponent(Utils.localizeMessage('permalink.error.access', 'Permalink belongs to a deleted message or to a channel to which you do not have access.')));
        }
    );
}

export function emitCloseRightHandSide() {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_SEARCH,
        results: null
    });

    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_POST_SELECTED,
        postId: null
    });
}

export function emitPostFocusRightHandSideFromSearch(post, isMentionSearch) {
    Client.getPost(
        post.channel_id,
        post.id,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: post.channel_id,
                numRequested: 0,
                post_list: data
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: Utils.getRootId(post),
                from_search: SearchStore.getSearchTerm()
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: null,
                is_mention_search: isMentionSearch
            });
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getPost');
        }
    );
}

export function emitLeaveTeam() {
    Client.removeUserFromTeam(
        TeamStore.getCurrentId(),
        UserStore.getCurrentId(),
        () => {
            // DO nothing.  The websocket should cause a re-direct
        },
        (err) => {
            AsyncClient.dispatchError(err, 'removeUserFromTeam');
        }
    );
}

export function emitLoadMorePostsEvent() {
    const id = ChannelStore.getCurrentId();
    loadMorePostsTop(id, false);
}

export function emitLoadMorePostsFocusedTopEvent() {
    const id = PostStore.getFocusedPostId();
    loadMorePostsTop(id, true);
}

export function loadMorePostsTop(id, isFocusPost) {
    const earliestPostId = PostStore.getEarliestPost(id).id;
    if (PostStore.requestVisibilityIncrease(id, Constants.POST_CHUNK_SIZE)) {
        AsyncClient.getPostsBefore(earliestPostId, 0, Constants.POST_CHUNK_SIZE, isFocusPost);
    }
}

export function emitLoadMorePostsFocusedBottomEvent() {
    const id = PostStore.getFocusedPostId();
    const latestPostId = PostStore.getLatestPost(id).id;
    AsyncClient.getPostsAfter(latestPostId, 0, Constants.POST_CHUNK_SIZE, !!id);
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

export function emitPostDeletedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.POST_DELETED,
        post
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

export function showGetPostLinkModal(post) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_GET_POST_LINK_MODAL,
        value: true,
        post
    });
}

export function showGetPublicLinkModal(filename) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_GET_PUBLIC_LINK_MODAL,
        value: true,
        filename
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
    if (preference.category === Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW) {
        AsyncClient.getDirectProfiles();
    }

    AppDispatcher.handleServerAction({
        type: Constants.ActionTypes.RECEIVED_PREFERENCE,
        preference
    });
}

export function emitRemovePost(post) {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.REMOVE_POST,
        post
    });
}

export function sendEphemeralPost(message, channelId) {
    const timestamp = Utils.getTimestamp();
    const post = {
        id: Utils.generateId(),
        user_id: '0',
        channel_id: channelId || ChannelStore.getCurrentId(),
        message,
        type: Constants.POST_TYPE_EPHEMERAL,
        create_at: timestamp,
        update_at: timestamp,
        filenames: [],
        props: {}
    };

    handleNewPost(post);
}

export function newLocalizationSelected(locale) {
    if (locale === 'en') {
        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_LOCALE,
            locale,
            translations: en
        });
    } else {
        const localeInfo = I18n.getLanguageInfo(locale) || I18n.getLanguageInfo(global.window.mm_config.DefaultClientLocale);

        Client.getTranslations(
            localeInfo.url,
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
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getTranslations');
            }
        );
    }
}

export function loadDefaultLocale() {
    const defaultLocale = global.window.mm_config.DefaultClientLocale;
    let locale = global.window.mm_user ? global.window.mm_user.locale || defaultLocale : defaultLocale;

    if (!I18n.getLanguageInfo(locale)) {
        locale = 'en';
    }
    return newLocalizationSelected(locale);
}

export function viewLoggedIn() {
    AsyncClient.getChannels();
    AsyncClient.getChannelExtraInfo();

    // Clear pending posts (shouldn't have pending posts if we are loading)
    PostStore.clearPendingPosts();
}

var lastTimeTypingSent = 0;
export function emitLocalUserTypingEvent(channelId, parentId) {
    const t = Date.now();
    if ((t - lastTimeTypingSent) > Constants.UPDATE_TYPING_MS) {
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

export function emitUserLoggedOutEvent(redirectTo) {
    const rURL = (redirectTo && typeof redirectTo === 'string') ? redirectTo : '/';
    Client.logout(
        () => {
            BrowserStore.signalLogout();
            BrowserStore.clear();
            ErrorStore.clearLastError();
            PreferenceStore.clear();
            UserStore.clear();
            TeamStore.clear();
            browserHistory.push(rURL);
        },
        () => {
            browserHistory.push(rURL);
        }
    );
}

export function emitJoinChannelEvent(channel, success, failure) {
    Client.joinChannel(
        channel.id,
        success,
        failure
    );
}
