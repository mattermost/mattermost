// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import SearchStore from 'stores/search_store.jsx';
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'utils/web_client.jsx';
import * as Utils from 'utils/utils.jsx';
import * as Websockets from './websocket_actions.jsx';
import * as I18n from 'i18n/i18n.jsx';

import {browserHistory} from 'react-router';

import en from 'i18n/en.json';

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
        Client.trackPage();

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

export function emitPostFocusEvent(postId) {
    AsyncClient.getChannels(true);
    Client.getPostById(
        postId,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_FOCUSED_POST,
                postId,
                post_list: data
            });

            AsyncClient.getChannelExtraInfo(data.channel_id);

            AsyncClient.getPostsBefore(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS);
            AsyncClient.getPostsAfter(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS);
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

export function emitLoadMorePostsEvent() {
    const id = ChannelStore.getCurrentId();
    loadMorePostsTop(id);
}

export function emitLoadMorePostsFocusedTopEvent() {
    const id = PostStore.getFocusedPostId();
    loadMorePostsTop(id);
}

export function loadMorePostsTop(id) {
    const earliestPostId = PostStore.getEarliestPost(id).id;
    if (PostStore.requestVisibilityIncrease(id, Constants.POST_CHUNK_SIZE)) {
        AsyncClient.getPostsBefore(earliestPostId, 0, Constants.POST_CHUNK_SIZE);
    }
}

export function emitLoadMorePostsFocusedBottomEvent() {
    const id = PostStore.getFocusedPostId();
    const latestPostId = PostStore.getLatestPost(id).id;
    AsyncClient.getPostsAfter(latestPostId, 0, Constants.POST_CHUNK_SIZE);
}

export function emitPostRecievedEvent(post, msg) {
    if (ChannelStore.getCurrentId() === post.channel_id) {
        if (window.isActive) {
            AsyncClient.updateLastViewedAt();
        } else {
            AsyncClient.getChannel(post.channel_id);
        }
    } else if (msg && TeamStore.getCurrentId() === msg.team_id) {
        AsyncClient.getChannel(post.channel_id);
    }

    var websocketMessageProps = null;
    if (msg) {
        websocketMessageProps = msg.props;
    }

    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_POST,
        post,
        websocketMessageProps
    });
}

export function emitUserPostedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.CREATE_POST,
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

export function showRegisterAppModal() {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_REGISTER_APP_MODAL,
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

    emitPostRecievedEvent(post);
}

export function newLocalizationSelected(locale) {
    if (locale === 'en') {
        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_LOCALE,
            locale,
            translations: en
        });
    } else {
        Client.getTranslations(
            I18n.getLanguageInfo(locale).url,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_LOCALE,
                    locale,
                    translations: data
                });
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getTranslations');
            }
        );
    }
}

export function loadBrowserLocale() {
    let locale = (navigator.languages && navigator.languages.length > 0 ? navigator.languages[0] :
        (navigator.language || navigator.userLanguage)).split('-')[0];
    if (!I18n.getLanguages()[locale]) {
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
        Websockets.sendMessage({channel_id: channelId, action: 'typing', props: {parent_id: parentId}, state: {}});
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
