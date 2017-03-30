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

import {handleNewPost, loadPosts, loadPostsBefore, loadPostsAfter} from 'actions/post_actions.jsx';
import {loadProfilesForSidebar} from 'actions/user_actions.jsx';
import {loadChannelsForCurrentUser} from 'actions/channel_actions.jsx';
import {stopPeriodicStatusUpdates} from 'actions/status_actions.jsx';
import * as WebsocketActions from 'actions/websocket_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import WebSocketClient from 'client/web_websocket_client.jsx';
import {sortTeamsByDisplayName} from 'utils/team_utils.jsx';
import * as Utils from 'utils/utils.jsx';

import en from 'i18n/en.json';
import * as I18n from 'i18n/i18n.jsx';
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
        const channelMember = ChannelStore.getMyMember(chan.id);
        const getMyChannelMemberPromise = AsyncClient.getChannelMember(chan.id, UserStore.getCurrentId());
        const oldChannelId = ChannelStore.getCurrentId();

        getMyChannelMemberPromise.then(() => {
            AsyncClient.getChannelStats(chan.id, true);
            AsyncClient.viewChannel(chan.id, oldChannelId);
            loadPosts(chan.id);
        });

        // Subtract mentions for the team
        const {msgs, mentions} = ChannelStore.getUnreadCounts()[chan.id] || {msgs: 0, mentions: 0};
        TeamStore.subtractUnread(chan.team_id, msgs, mentions);

        // Mark previous and next channel as read
        ChannelStore.resetCounts(oldChannelId);
        ChannelStore.resetCounts(chan.id);

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

export function emitInitialLoad(callback) {
    Client.getInitialLoad(
            (data) => {
                global.window.mm_config = data.client_cfg;
                global.window.mm_license = data.license_cfg;

                if (global.window && global.window.analytics) {
                    global.window.analytics.identify(global.window.mm_config.DiagnosticId, {}, {
                        context: {
                            ip: '0.0.0.0'
                        },
                        page: {
                            path: '',
                            referrer: '',
                            search: '',
                            title: '',
                            url: ''
                        },
                        anonymousId: '00000000000000000000000000'
                    });
                }

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
                        type: ActionTypes.RECEIVED_MY_TEAM_MEMBERS,
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
    loadChannelsForCurrentUser();
    AsyncClient.getMoreChannels(true);
    AsyncClient.getChannelStats(channelId);
    loadPostsBefore(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS, true);
    loadPostsAfter(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS, true);
}

export function emitPostFocusEvent(postId, onSuccess) {
    loadChannelsForCurrentUser();
    Client.getPermalinkTmp(
        postId,
        (data) => {
            if (!data) {
                return;
            }
            const channelId = data.posts[data.order[0]].channel_id;
            doFocusPost(channelId, postId, data);

            if (onSuccess) {
                onSuccess();
            }
        },
        () => {
            let link = `${TeamStore.getCurrentTeamRelativeUrl()}/channels/`;
            const channel = ChannelStore.getCurrent();
            if (channel) {
                link += channel.name;
            } else {
                link += 'town-square';
            }

            browserHistory.push('/error?message=' + encodeURIComponent(Utils.localizeMessage('permalink.error.access', 'Permalink belongs to a deleted message or to a channel to which you do not have access.')) + '&link=' + encodeURIComponent(link));
        }
    );
}

export function emitCloseRightHandSide() {
    SearchStore.storeSearchResults(null, false, false);
    SearchStore.emitSearchChange();

    PostStore.storeSelectedPostId(null);
    PostStore.emitSelectedPostChange(false, false);
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
                from_search: SearchStore.getSearchTerm(),
                from_flagged_posts: SearchStore.getIsFlaggedPosts()
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
    const earliestPostId = PostStore.getEarliestPostFromPage(id).id;
    if (PostStore.requestVisibilityIncrease(id, Constants.POST_CHUNK_SIZE)) {
        loadPostsBefore(earliestPostId, 0, Constants.POST_CHUNK_SIZE, isFocusPost);
    }
}

export function emitLoadMorePostsFocusedBottomEvent() {
    const id = PostStore.getFocusedPostId();
    const latestPostId = PostStore.getLatestPost(id).id;
    loadPostsAfter(latestPostId, 0, Constants.POST_CHUNK_SIZE, Boolean(id));
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

    if (preference.category === Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW) {
        loadProfilesForSidebar();
    }
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
        type: Constants.PostTypes.EPHEMERAL,
        create_at: timestamp,
        update_at: timestamp,
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
    // Clear pending posts (shouldn't have pending posts if we are loading)
    PostStore.clearPendingPosts();
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
    Client.logout(
        () => {
            if (shouldSignalLogout) {
                BrowserStore.signalLogout();
            }

            clientLogout(redirectTo);
        },
        () => {
            browserHistory.push(redirectTo);
        }
    );
}

export function clientLogout(redirectTo = '/') {
    BrowserStore.clear();
    ErrorStore.clearLastError();
    PreferenceStore.clear();
    UserStore.clear();
    TeamStore.clear();
    ChannelStore.clear();
    stopPeriodicStatusUpdates();
    WebsocketActions.close();
    window.location.href = redirectTo;
}

export function emitSearchMentionsEvent(user) {
    let terms = '';
    if (user.notify_props && user.notify_props.mention_keys) {
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
            Client.setTeamId(teamId);
            Client.getChannel(
                channelId,
                (data) => {
                    redirect(teams[teamId].name, data.channel.name);
                },
                () => {
                    redirect(teams[teamId].name, 'town-square');
                }
            );
        } else {
            redirect(teams[teamId].name, 'town-square');
        }
    } else {
        browserHistory.push('/select_team');
    }
}

requestOpenGraphMetadata.openGraphMetadataOnGoingRequests = {};  // Format: {<url>: true}
export function requestOpenGraphMetadata(url) {
    if (global.mm_config.EnableLinkPreviews !== 'true') {
        return;
    }

    const onself = requestOpenGraphMetadata;

    if (!onself.openGraphMetadataOnGoingRequests[url]) {
        onself.openGraphMetadataOnGoingRequests[url] = true;

        Client.getOpenGraphMetadata(url,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIVED_OPEN_GRAPH_METADATA,
                    url,
                    data
                });
                delete onself.openGraphMetadataOnGoingRequests[url];
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getOpenGraphMetadata');
                delete onself.openGraphMetadataOnGoingRequests[url];
            }
        );
    }
}
