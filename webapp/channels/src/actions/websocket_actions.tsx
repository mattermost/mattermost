// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {batchActions} from 'redux-batched-actions';

import {WebSocketEvents} from '@mattermost/client';

import {
    ChannelTypes,
    EmojiTypes,
    GroupTypes,
    PostTypes,
    TeamTypes,
    UserTypes,
    RoleTypes,
    GeneralTypes,
    AdminTypes,
    IntegrationTypes,
    PreferenceTypes,
    AppsTypes,
    CloudTypes,
    ChannelBookmarkTypes,
    ScheduledPostTypes,
    ContentFlaggingTypes,
} from 'mattermost-redux/action_types';
import {getStandardAnalytics} from 'mattermost-redux/actions/admin';
import {fetchAppBindings, fetchRHSAppsBindings} from 'mattermost-redux/actions/apps';
import {addChannelToInitialCategory, fetchMyCategories, receivedCategoryOrder} from 'mattermost-redux/actions/channel_categories';
import {
    getChannelAndMyMember,
    getMyChannelMember,
    getChannelStats,
    markMultipleChannelsAsRead,
    getChannelMemberCountsByGroup,
    fetchAllMyChannelMembers,
    fetchAllMyTeamsChannels,
    fetchChannelsAndMembers,
} from 'mattermost-redux/actions/channels';
import {clearErrors, logError} from 'mattermost-redux/actions/errors';
import {setServerVersion, getClientConfig, getCustomProfileAttributeFields} from 'mattermost-redux/actions/general';
import {getGroup as fetchGroup} from 'mattermost-redux/actions/groups';
import {getServerLimits} from 'mattermost-redux/actions/limits';
import {
    getCustomEmojiForReaction,
    getPosts,
    getPostThread,
    getPostThreads,
    postDeleted,
    receivedNewPost,
    receivedPost,
} from 'mattermost-redux/actions/posts';
import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {fetchTeamScheduledPosts} from 'mattermost-redux/actions/scheduled_posts';
import {batchFetchStatusesProfilesGroupsFromPosts} from 'mattermost-redux/actions/status_profile_polling';
import * as TeamActions from 'mattermost-redux/actions/teams';
import {
    getThread as fetchThread,
    getCountsAndThreadsSince,
    handleAllMarkedRead,
    handleReadChanged,
    handleFollowChanged,
    handleThreadArrived,
    handleAllThreadsInChannelMarkedRead,
    updateThreadRead,
    decrementThreadCounts,
} from 'mattermost-redux/actions/threads';
import {
    checkForModifiedUsers,
    getUser as loadUser,
} from 'mattermost-redux/actions/users';
import {removeNotVisibleUsers} from 'mattermost-redux/actions/websocket';
import {Client4} from 'mattermost-redux/client';
import {General, Permissions} from 'mattermost-redux/constants';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {
    getChannel,
    getChannelMembersInChannels,
    getChannelsInTeam,
    getCurrentChannel,
    getCurrentChannelId,
    getRedirectChannelNameForTeam,
} from 'mattermost-redux/selectors/entities/channels';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';
import {getPost, getMostRecentPostIdInChannel, getTeamIdFromPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveISystemPermission, haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {
    getTeamIdByChannelId,
    getMyTeams,
    getCurrentTeamId,
    getCurrentTeamUrl,
    getTeam,
    getRelativeTeamUrl,
} from 'mattermost-redux/selectors/entities/teams';
import {getNewestThreadInTeam, getThread, getThreads} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUser, getCurrentUserId, getUser, getIsManualStatusForUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import {loadChannelsForCurrentUser} from 'actions/channel_actions';
import {
    getTeamsUsage,
} from 'actions/cloud';
import {loadCustomEmojisIfNeeded} from 'actions/emoji_actions';
import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {sendDesktopNotification} from 'actions/notification_actions';
import {handleNewPost} from 'actions/post_actions';
import * as StatusActions from 'actions/status_actions';
import {setGlobalItem} from 'actions/storage';
import {loadProfilesForDM, loadProfilesForGM, loadProfilesForSidebar} from 'actions/user_actions';
import {syncPostsInChannel} from 'actions/views/channel';
import {setGlobalDraft, transformServerDraft} from 'actions/views/drafts';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {incrementWsErrorCount, resetWsErrorCount} from 'actions/views/system';
import {updateThreadLastOpened} from 'actions/views/threads';
import {getSelectedChannelId, getSelectedPost} from 'selectors/rhs';
import {isThreadOpen, isThreadManuallyUnread} from 'selectors/views/threads';
import store from 'stores/redux_store';

import DialogRouter from 'components/dialog_router';
import RemovedFromChannelModal from 'components/removed_from_channel_modal';

import WebSocketClient from 'client/web_websocket_client';
import {loadPlugin, loadPluginsIfNecessary, removePlugin} from 'plugins';
import {getHistory} from 'utils/browser_history';
import {ActionTypes, Constants, AnnouncementBarMessages, SocketEvents, UserStatuses, ModalIdentifiers, PageLoadContext} from 'utils/constants';
import {getSiteURL} from 'utils/url';

import {temporarilySetPageLoadContext} from './telemetry_actions';

const dispatch = store.dispatch;
const getState = store.getState;

const MAX_WEBSOCKET_FAILS = 7;

const pluginEventHandlers = {};

export function initialize() {
    if (!window.WebSocket) {
        // eslint-disable-next-line no-console
        console.log('Browser does not support WebSocket');
        return;
    }

    // eslint-disable-next-line no-console
    console.log('Initializing or re-initializing WebSocket');

    const config = getConfig(getState());
    let connUrl = '';
    if (config.WebsocketURL) {
        connUrl = config.WebsocketURL;
    } else {
        connUrl = new URL(getSiteURL());

        // replace the protocol with a websocket one
        if (connUrl.protocol === 'https:') {
            connUrl.protocol = 'wss:';
        } else {
            connUrl.protocol = 'ws:';
        }

        // append a port number if one isn't already specified
        if (!(/:\d+$/).test(connUrl.host)) {
            if (connUrl.protocol === 'wss:') {
                connUrl.host += ':' + config.WebsocketSecurePort;
            } else {
                connUrl.host += ':' + config.WebsocketPort;
            }
        }

        connUrl = connUrl.toString();
    }

    // Strip any trailing slash before appending the pathname below.
    if (connUrl.length > 0 && connUrl[connUrl.length - 1] === '/') {
        connUrl = connUrl.substring(0, connUrl.length - 1);
    }

    connUrl += Client4.getUrlVersion() + '/websocket';

    WebSocketClient.addMessageListener(handleEvent);
    WebSocketClient.addFirstConnectListener(handleFirstConnect);
    WebSocketClient.addReconnectListener(reconnect);
    WebSocketClient.addMissedMessageListener(restart);
    WebSocketClient.addCloseListener(handleClose);

    WebSocketClient.initialize(connUrl, undefined, true);
}

export function close() {
    WebSocketClient.close();

    WebSocketClient.removeMessageListener(handleEvent);
    WebSocketClient.removeFirstConnectListener(handleFirstConnect);
    WebSocketClient.removeReconnectListener(reconnect);
    WebSocketClient.removeMissedMessageListener(restart);
    WebSocketClient.removeCloseListener(handleClose);
}

const pluginReconnectHandlers = {};

export function registerPluginReconnectHandler(pluginId, handler) {
    pluginReconnectHandlers[pluginId] = handler;
}

export function unregisterPluginReconnectHandler(pluginId) {
    Reflect.deleteProperty(pluginReconnectHandlers, pluginId);
}

function restart() {
    reconnect();

    // We fetch the client config again on the server restart.
    dispatch(getClientConfig());
}

export function reconnect() {
    // eslint-disable-next-line
    console.log('Reconnecting WebSocket');

    temporarilySetPageLoadContext(PageLoadContext.RECONNECT);

    dispatch({
        type: GeneralTypes.WEBSOCKET_SUCCESS,
        timestamp: Date.now(),
    });

    const state = getState();
    const currentTeamId = getCurrentTeamId(state);
    if (currentTeamId) {
        const currentUserId = getCurrentUserId(state);
        const currentChannelId = getCurrentChannelId(state);
        const mostRecentId = getMostRecentPostIdInChannel(state, currentChannelId);
        const mostRecentPost = getPost(state, mostRecentId);

        if (appsEnabled(state)) {
            dispatch(handleRefreshAppsBindings());
        }

        dispatch(fetchAllMyTeamsChannels());
        dispatch(fetchTeamScheduledPosts(currentTeamId, true, true));
        dispatch(fetchAllMyChannelMembers());
        dispatch(fetchMyCategories(currentTeamId));
        loadProfilesForSidebar();

        if (mostRecentPost) {
            dispatch(syncPostsInChannel(currentChannelId, mostRecentPost.create_at));
        } else if (currentChannelId) {
            // if network timed-out the first time when loading a channel
            // we can request for getPosts again when socket is connected
            dispatch(getPosts(currentChannelId));
        }

        const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);
        if (enabledUserStatuses) {
            dispatch(StatusActions.addVisibleUsersInCurrentChannelAndSelfToStatusPoll());
        }

        const crtEnabled = isCollapsedThreadsEnabled(state);
        dispatch(TeamActions.getMyTeamUnreads(crtEnabled));
        if (crtEnabled) {
            const teams = getMyTeams(state);
            syncThreads(currentTeamId, currentUserId);

            for (const team of teams) {
                if (team.id === currentTeamId) {
                    continue;
                }
                syncThreads(team.id, currentUserId);
            }
        }

        // Re-syncing the current channel and team ids.
        WebSocketClient.updateActiveChannel(currentChannelId);
        WebSocketClient.updateActiveTeam(currentTeamId);
    }

    loadPluginsIfNecessary();

    Object.values(pluginReconnectHandlers).forEach((handler) => {
        if (handler && typeof handler === 'function') {
            handler();
        }
    });

    // Refresh custom profile attributes on reconnect
    dispatch(getCustomProfileAttributeFields());

    if (state.websocket.lastDisconnectAt) {
        dispatch(checkForModifiedUsers());
    }

    dispatch(resetWsErrorCount());
    dispatch(clearErrors());
}

function syncThreads(teamId, userId) {
    const state = getState();
    const newestThread = getNewestThreadInTeam(state, teamId);

    // no need to sync if we have nothing yet
    if (!newestThread) {
        return;
    }
    dispatch(getCountsAndThreadsSince(userId, teamId, newestThread.last_reply_at));
}

export function registerPluginWebSocketEvent(pluginId, event, action) {
    if (!pluginEventHandlers[pluginId]) {
        pluginEventHandlers[pluginId] = {};
    }
    pluginEventHandlers[pluginId][event] = action;
}

export function unregisterPluginWebSocketEvent(pluginId, event) {
    const events = pluginEventHandlers[pluginId];
    if (!events) {
        return;
    }

    Reflect.deleteProperty(events, event);
}

export function unregisterAllPluginWebSocketEvents(pluginId) {
    Reflect.deleteProperty(pluginEventHandlers, pluginId);
}

function handleFirstConnect() {
    dispatch(batchActions([
        {
            type: GeneralTypes.WEBSOCKET_SUCCESS,
            timestamp: Date.now(),
        },
        clearErrors(),
    ]));
}

function handleClose(failCount) {
    if (failCount > MAX_WEBSOCKET_FAILS) {
        dispatch(logError({type: 'critical', message: AnnouncementBarMessages.WEBSOCKET_PORT_ERROR}, true));
    }
    dispatch(batchActions([
        {
            type: GeneralTypes.WEBSOCKET_FAILURE,
            timestamp: Date.now(),
        },
        incrementWsErrorCount(),
    ]));
}

/**
 * @param {import('@mattermost/client').WebSocketMessage} msg
 */
export function handleEvent(msg) {
    switch (msg.event) {
    case WebSocketEvents.Posted:
    case WebSocketEvents.EphemeralMessage:
        handleNewPostEventDebounced(msg);
        break;

    case WebSocketEvents.PostEdited:
        handlePostEditEvent(msg);
        break;

    case WebSocketEvents.PostDeleted:
        handlePostDeleteEvent(msg);
        break;

    case WebSocketEvents.PostUnread:
        handlePostUnreadEvent(msg);
        break;

    case WebSocketEvents.LeaveTeam:
        handleLeaveTeamEvent(msg);
        break;

    case WebSocketEvents.UpdateTeam:
        handleUpdateTeamEvent(msg);
        break;

    case WebSocketEvents.UpdateTeamScheme:
        handleUpdateTeamSchemeEvent(msg);
        break;

    case WebSocketEvents.DeleteTeam:
        handleDeleteTeamEvent(msg);
        break;

    case WebSocketEvents.AddedToTeam:
        handleTeamAddedEvent(msg);
        break;

    case WebSocketEvents.UserAdded:
        dispatch(handleUserAddedEvent(msg));
        break;

    case WebSocketEvents.UserRemoved:
        handleUserRemovedEvent(msg);
        break;

    case WebSocketEvents.UserUpdated:
        handleUserUpdatedEvent(msg);
        break;

    case WebSocketEvents.ChannelSchemeUpdated:
        handleChannelSchemeUpdatedEvent(msg);
        break;

    case WebSocketEvents.MemberRoleUpdated:
        handleUpdateMemberRoleEvent(msg);
        break;

    case WebSocketEvents.RoleUpdated:
        handleRoleUpdatedEvent(msg);
        break;

    case WebSocketEvents.ChannelCreated:
        dispatch(handleChannelCreatedEvent(msg));
        break;

    case WebSocketEvents.ChannelDeleted:
        handleChannelDeletedEvent(msg);
        break;

    case WebSocketEvents.ChannelRestored:
        handleChannelUnarchivedEvent(msg);
        break;

    case WebSocketEvents.ChannelConverted:
        handleChannelConvertedEvent(msg);
        break;

    case WebSocketEvents.ChannelUpdated:
        dispatch(handleChannelUpdatedEvent(msg));
        break;

    case WebSocketEvents.ChannelMemberUpdated:
        handleChannelMemberUpdatedEvent(msg);
        break;

    case WebSocketEvents.ChannelBookmarkCreated:
        dispatch(handleChannelBookmarkCreated(msg));
        break;

    case WebSocketEvents.ChannelBookmarkUpdated:
        dispatch(handleChannelBookmarkUpdated(msg));
        break;

    case WebSocketEvents.ChannelBookmarkDeleted:
        dispatch(handleChannelBookmarkDeleted(msg));
        break;

    case WebSocketEvents.ChannelBookmarkSorted:
        dispatch(handleChannelBookmarkSorted(msg));
        break;

    case WebSocketEvents.DirectAdded:
        dispatch(handleDirectAddedEvent(msg));
        break;

    case WebSocketEvents.GroupAdded:
        dispatch(handleGroupAddedEvent(msg));
        break;

    case WebSocketEvents.PreferenceChanged:
        handlePreferenceChangedEvent(msg);
        break;

    case WebSocketEvents.PreferencesChanged:
        handlePreferencesChangedEvent(msg);
        break;

    case WebSocketEvents.PreferencesDeleted:
        handlePreferencesDeletedEvent(msg);
        break;

    case WebSocketEvents.StatusChange:
        dispatch(handleStatusChangedEvent(msg));
        break;

    case WebSocketEvents.Hello:
        handleHelloEvent(msg);
        break;

    case WebSocketEvents.ReactionAdded:
        handleReactionAddedEvent(msg);
        break;

    case WebSocketEvents.ReactionRemoved:
        handleReactionRemovedEvent(msg);
        break;

    case WebSocketEvents.EmojiAdded:
        handleAddEmoji(msg);
        break;

    case WebSocketEvents.MultipleChannelsViewed:
        handleMultipleChannelsViewedEvent(msg);
        break;

    case WebSocketEvents.PluginEnabled:
        handlePluginEnabled(msg);
        break;

    case WebSocketEvents.PluginDisabled:
        handlePluginDisabled(msg);
        break;

    case WebSocketEvents.UserRoleUpdated:
        handleUserRoleUpdated(msg);
        break;

    case WebSocketEvents.ConfigChanged:
        handleConfigChanged(msg);
        break;

    case WebSocketEvents.LicenseChanged:
        handleLicenseChanged(msg);
        break;

    case WebSocketEvents.PluginStatusesChanged:
        handlePluginStatusesChangedEvent(msg);
        break;

    case WebSocketEvents.OpenDialog:
        handleOpenDialogEvent(msg);
        break;

    case WebSocketEvents.ReceivedGroup:
        handleGroupUpdatedEvent(msg);
        break;

    case WebSocketEvents.GroupMemberAdded:
        dispatch(handleGroupAddedMemberEvent(msg));
        break;

    case WebSocketEvents.GroupMemberDeleted:
        dispatch(handleGroupDeletedMemberEvent(msg));
        break;

    case WebSocketEvents.ReceivedGroupAssociatedToTeam:
        handleGroupAssociatedToTeamEvent(msg);
        break;

    case WebSocketEvents.ReceivedGroupNotAssociatedToTeam:
        handleGroupNotAssociatedToTeamEvent(msg);
        break;

    case WebSocketEvents.ReceivedGroupAssociatedToChannel:
        handleGroupAssociatedToChannelEvent(msg);
        break;

    case WebSocketEvents.ReceivedGroupNotAssociatedToChannel:
        handleGroupNotAssociatedToChannelEvent(msg);
        break;

    case WebSocketEvents.SidebarCategoryCreated:
        dispatch(handleSidebarCategoryCreated(msg));
        break;

    case WebSocketEvents.SidebarCategoryUpdated:
        dispatch(handleSidebarCategoryUpdated(msg));
        break;

    case WebSocketEvents.SidebarCategoryDeleted:
        dispatch(handleSidebarCategoryDeleted(msg));
        break;
    case WebSocketEvents.SidebarCategoryOrderUpdated:
        dispatch(handleSidebarCategoryOrderUpdated(msg));
        break;
    case WebSocketEvents.UserActivationStatusChange:
        dispatch(handleUserActivationStatusChange());
        break;
    case WebSocketEvents.CloudSubscriptionChanged:
        dispatch(handleCloudSubscriptionChanged(msg));
        break;
    case WebSocketEvents.FirstAdminVisitMarketplaceStatusReceived:
        handleFirstAdminVisitMarketplaceStatusReceivedEvent(msg);
        break;
    case WebSocketEvents.ThreadFollowChanged:
        dispatch(handleThreadFollowChanged(msg));
        break;
    case WebSocketEvents.ThreadReadChanged:
        dispatch(handleThreadReadChanged(msg));
        break;
    case WebSocketEvents.ThreadUpdated:
        dispatch(handleThreadUpdated(msg));
        break;
    case SocketEvents.APPS_FRAMEWORK_REFRESH_BINDINGS:
        dispatch(handleRefreshAppsBindings());
        break;
    case SocketEvents.APPS_FRAMEWORK_PLUGIN_ENABLED:
        dispatch(handleAppsPluginEnabled());
        break;
    case SocketEvents.APPS_FRAMEWORK_PLUGIN_DISABLED:
        dispatch(handleAppsPluginDisabled());
        break;
    case WebSocketEvents.PostAcknowledgementAdded:
        dispatch(handlePostAcknowledgementAdded(msg));
        break;
    case WebSocketEvents.PostAcknowledgementRemoved:
        dispatch(handlePostAcknowledgementRemoved(msg));
        break;
    case WebSocketEvents.DraftCreated:
    case WebSocketEvents.DraftUpdated:
        dispatch(handleUpsertDraftEvent(msg));
        break;
    case WebSocketEvents.DraftDeleted:
        dispatch(handleDeleteDraftEvent(msg));
        break;
    case WebSocketEvents.ScheduledPostCreated:
        dispatch(handleCreateScheduledPostEvent(msg));
        break;
    case WebSocketEvents.ScheduledPostUpdated:
        dispatch(handleUpdateScheduledPostEvent(msg));
        break;
    case WebSocketEvents.ScheduledPostDeleted:
        dispatch(handleDeleteScheduledPostEvent(msg));
        break;
    case WebSocketEvents.PersistentNotificationTriggered:
        dispatch(handlePersistentNotification(msg));
        break;
    case WebSocketEvents.CPAValuesUpdated:
        dispatch(handleCustomAttributeValuesUpdated(msg));
        break;
    case WebSocketEvents.CPAFieldCreated:
        dispatch(handleCustomAttributesCreated(msg));
        break;
    case WebSocketEvents.CPAFieldUpdated:
        dispatch(handleCustomAttributesUpdated(msg));
        break;
    case WebSocketEvents.CPAFieldDeleted:
        dispatch(handleCustomAttributesDeleted(msg));
        break;
    case WebSocketEvents.ContentFlaggingReportValueUpdated:
        dispatch(handleContentFlaggingReportValueChanged(msg));
        break;
    default:
    }

    Object.values(pluginEventHandlers).forEach((pluginEvents) => {
        if (!pluginEvents) {
            return;
        }

        if (Object.hasOwn(pluginEvents, msg.event) && typeof pluginEvents[msg.event] === 'function') {
            pluginEvents[msg.event](msg);
        }
    });
}

// handleChannelConvertedEvent handles updating of channel which is converted from public to private
function handleChannelConvertedEvent(msg) {
    const channelId = msg.data.channel_id;
    if (channelId) {
        const channel = getChannel(getState(), channelId);
        if (channel) {
            dispatch({
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: {...channel, type: General.PRIVATE_CHANNEL},
            });
        }
    }
}

export function handleChannelUpdatedEvent(msg) {
    return (doDispatch, doGetState) => {
        const channel = JSON.parse(msg.data.channel);

        const actions = [{type: ChannelTypes.RECEIVED_CHANNEL, data: channel}];

        // handling the case of GM converted to private channel.
        const state = doGetState();
        const existingChannel = getChannel(state, channel.id);

        // if the updated channel exists in store
        if (existingChannel) {
            // and it was a GM, converted to a private channel
            if (existingChannel.type === General.GM_CHANNEL && channel.type === General.PRIVATE_CHANNEL) {
                actions.push({type: ChannelTypes.GM_CONVERTED_TO_CHANNEL, data: channel});
            }
        }

        doDispatch(batchActions(actions));

        if (channel.id === getCurrentChannelId(state)) {
            // using channel's team_id to ensure we always redirect to current channel even if channel's team changes.
            const teamId = channel.team_id || getCurrentTeamId(state);
            getHistory().replace(`${getRelativeTeamUrl(state, teamId)}/channels/${channel.name}`);
        }
    };
}

function handleChannelMemberUpdatedEvent(msg) {
    const channelMember = JSON.parse(msg.data.channelMember);
    const roles = channelMember.roles.split(' ');
    dispatch(loadRolesIfNeeded(roles));
    dispatch({type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER, data: channelMember});
}

function debouncePostEvent(wait) {
    let timeout;
    let queue = [];
    let count = 0;

    // Called when timeout triggered
    const triggered = () => {
        timeout = null;

        if (queue.length > 0) {
            dispatch(handleNewPostEvents(queue));
        }

        queue = [];
        count = 0;
    };

    return function fx(msg) {
        if (timeout && count > 4) {
            // If the timeout is going this is the second or further event so queue them up.
            if (queue.push(msg) > 200) {
                // Don't run us out of memory, give up if the queue gets insane
                queue = [];
                console.log('channel broken because of too many incoming messages'); //eslint-disable-line no-console
            }
            clearTimeout(timeout);
            timeout = setTimeout(triggered, wait);
        } else {
            // Apply immediately for events up until count reaches limit
            count += 1;
            dispatch(handleNewPostEvent(msg));
            clearTimeout(timeout);
            timeout = setTimeout(triggered, wait);
        }
    };
}

const handleNewPostEventDebounced = debouncePostEvent(100);

/**
 * @param {import('@mattermost/client').PostedMessage | import('@mattermost/client').EphemeralPostMessage} msg
 */
export function handleNewPostEvent(msg) {
    return (myDispatch, myGetState) => {
        const post = JSON.parse(msg.data.post);

        if (window.logPostEvents) {
            // eslint-disable-next-line no-console
            console.log('handleNewPostEvent - new post received', post);
        }

        myDispatch(handleNewPost(post, msg));
        myDispatch(batchFetchStatusesProfilesGroupsFromPosts([post]));

        // Since status updates aren't real time, assume another user is online if they have posted and:
        // 1. The user hasn't set their status manually to something that isn't online
        // 2. The server hasn't told the client not to set the user to online. This happens when:
        //     a. The post is from the auto responder
        //     b. The post is a response to a push notification
        if (
            post.user_id !== getCurrentUserId(myGetState()) &&
            !getIsManualStatusForUserId(myGetState(), post.user_id) &&
            msg.data.set_online
        ) {
            myDispatch({
                type: UserTypes.RECEIVED_STATUSES,
                data: {[post.user_id]: UserStatuses.ONLINE},
            });
        }
    };
}

export function handleNewPostEvents(queue) {
    return (myDispatch, myGetState) => {
        // Note that this method doesn't properly update the sidebar state for these posts
        const posts = queue.map((msg) => JSON.parse(msg.data.post));

        if (window.logPostEvents) {
            // eslint-disable-next-line no-console
            console.log('handleNewPostEvents - new posts received', posts);
        }

        posts.forEach((post, index) => {
            if (queue[index].data.should_ack) {
                WebSocketClient.acknowledgePostedNotification(post.id, 'not_sent', 'too_many_posts');
            }
        });

        // Receive the posts as one continuous block since they were received within a short period
        const crtEnabled = isCollapsedThreadsEnabled(myGetState());
        const actions = posts.map((post) => receivedNewPost(post, crtEnabled));
        myDispatch(batchActions(actions));

        // Load the posts' threads
        myDispatch(getPostThreads(posts));
        myDispatch(batchFetchStatusesProfilesGroupsFromPosts(posts));
    };
}

/**
 * @param {import('@mattermost/client').PostEditedMessage} msg
 */
export function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.data.post);

    if (window.logPostEvents) {
        // eslint-disable-next-line no-console
        console.log('handlePostEditEvent - post edit received', post);
    }

    const crtEnabled = isCollapsedThreadsEnabled(getState());
    dispatch(receivedPost(post, crtEnabled));

    dispatch(batchFetchStatusesProfilesGroupsFromPosts([post]));
}

/**
 * @param {import('@mattermost/client').PostDeletedMessage} msg
 */
async function handlePostDeleteEvent(msg) {
    const post = JSON.parse(msg.data.post);

    if (window.logPostEvents) {
        // eslint-disable-next-line no-console
        console.log('handlePostDeleteEvent - post delete received', post);
    }

    const state = getState();
    const collapsedThreads = isCollapsedThreadsEnabled(state);

    if (!post.root_id && collapsedThreads) {
        dispatch(decrementThreadCounts(post));
    }

    dispatch(postDeleted(post));

    // update thread when a comment is deleted and CRT is on
    if (post.root_id && collapsedThreads) {
        const thread = getThread(state, post.root_id);
        if (thread) {
            const userId = getCurrentUserId(state);
            const teamId = getTeamIdFromPost(state, post);
            if (teamId) {
                dispatch(fetchThread(userId, teamId, post.root_id, true));
            }
        } else {
            const res = await dispatch(getPostThread(post.root_id));
            if (res.data) {
                const {order, posts} = res.data;
                const rootPost = posts[order[0]];
                dispatch(receivedPost(rootPost));
            }
        }
    }

    if (post.is_pinned) {
        dispatch(getChannelStats(post.channel_id));
    }
}

/**
 * @param {import('@mattermost/client').PostUnreadMessage} msg
 */
export function handlePostUnreadEvent(msg) {
    dispatch(
        {
            type: ActionTypes.POST_UNREAD_SUCCESS,
            data: {
                lastViewedAt: msg.data.last_viewed_at,
                channelId: msg.broadcast.channel_id,
                msgCount: msg.data.msg_count,
                msgCountRoot: msg.data.msg_count_root,
                mentionCount: msg.data.mention_count,
                mentionCountRoot: msg.data.mention_count_root,
                urgentMentionCount: msg.data.urgent_mention_count,
            },
        },
    );
}

/**
 * @param {import('@mattermost/client').UserAddedToTeamMessage} msg
 */
async function handleTeamAddedEvent(msg) {
    await dispatch(TeamActions.getTeam(msg.data.team_id));
    await dispatch(TeamActions.getMyTeamMembers());
    const state = getState();
    await dispatch(TeamActions.getMyTeamUnreads(isCollapsedThreadsEnabled(state)));
    await dispatch(fetchChannelsAndMembers(msg.data.team_id));
    const license = getLicense(state);
    if (license.Cloud === 'true') {
        dispatch(getTeamsUsage());
    }
}

/**
 * @param {import('@mattermost/client').UserRemovedFromTeamMessage} msg
 */
export function handleLeaveTeamEvent(msg) {
    const state = getState();

    const actions = [
        {
            type: UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM,
            data: {id: msg.data.team_id, user_id: msg.data.user_id},
        },
        {
            type: TeamTypes.REMOVE_MEMBER_FROM_TEAM,
            data: {team_id: msg.data.team_id, user_id: msg.data.user_id},
        },
    ];

    const channelsPerTeam = getChannelsInTeam(state);
    const channels = (channelsPerTeam && channelsPerTeam[msg.data.team_id]) || [];

    for (const channel of channels) {
        actions.push({
            type: ChannelTypes.REMOVE_MEMBER_FROM_CHANNEL,
            data: {id: channel, user_id: msg.data.user_id},
        });
    }

    const config = getConfig(state);
    if (config.RestrictDirectMessage === 'team') {
        actions.push({type: ChannelTypes.RESTRICTED_DMS_TEAMS_CHANGED});
    }

    dispatch(batchActions(actions));
    const currentUser = getCurrentUser(state);

    if (currentUser.id === msg.data.user_id) {
        dispatch({type: TeamTypes.LEAVE_TEAM, data: {id: msg.data.team_id}});

        // if they are on the team being removed redirect them to default team
        if (getCurrentTeamId(state) === msg.data.team_id) {
            if (!global.location.pathname.startsWith('/admin_console')) {
                redirectUserToDefaultTeam();
            }
        }
        if (isGuest(currentUser.roles)) {
            dispatch(removeNotVisibleUsers());
        }
    } else {
        const team = getTeam(state, msg.data.team_id);
        const members = getChannelMembersInChannels(state);
        const isMember = Object.values(members).some((member) => member[msg.data.user_id]);
        if (team && isGuest(currentUser.roles) && !isMember) {
            dispatch(batchActions([
                {
                    type: UserTypes.PROFILE_NO_LONGER_VISIBLE,
                    data: {user_id: msg.data.user_id},
                },
                {
                    type: TeamTypes.REMOVE_MEMBER_FROM_TEAM,
                    data: {team_id: team.id, user_id: msg.data.user_id},
                },
            ]));
        }
    }
}

/**
 * @param {import('@mattermost/client').TeamMessage} msg
 */
function handleUpdateTeamEvent(msg) {
    const state = store.getState();
    const license = getLicense(state);
    dispatch({type: TeamTypes.UPDATED_TEAM, data: JSON.parse(msg.data.team)});
    if (license.Cloud === 'true') {
        dispatch(getTeamsUsage());
    }
}

/**
 * @param {import('@mattermost/client').UpdateTeamSchemeMessage} msg
 */
function handleUpdateTeamSchemeEvent() {
    dispatch(TeamActions.getMyTeamMembers());
}

/**
 * @param {import('@mattermost/client').TeamMessage} msg
 */
function handleDeleteTeamEvent(msg) {
    const deletedTeam = JSON.parse(msg.data.team);
    const state = store.getState();
    const {teams} = state.entities.teams;
    const license = getLicense(state);
    if (license.Cloud === 'true') {
        dispatch(getTeamsUsage());
    }
    if (
        deletedTeam &&
        teams &&
        teams[deletedTeam.id] &&
        teams[deletedTeam.id].delete_at === 0
    ) {
        const {currentUserId} = state.entities.users;
        const {currentTeamId, myMembers} = state.entities.teams;
        const teamMembers = Object.values(myMembers);
        const teamMember = teamMembers.find((m) => m.user_id === currentUserId && m.team_id === currentTeamId);

        let newTeamId = '';
        if (
            deletedTeam &&
            teamMember &&
            deletedTeam.id === teamMember.team_id
        ) {
            const myTeams = {};
            getMyTeams(state).forEach((t) => {
                myTeams[t.id] = t;
            });

            for (let i = 0; i < teamMembers.length; i++) {
                const memberTeamId = teamMembers[i].team_id;
                if (
                    myTeams &&
                    myTeams[memberTeamId] &&
                    myTeams[memberTeamId].delete_at === 0 &&
                    deletedTeam.id !== memberTeamId
                ) {
                    newTeamId = memberTeamId;
                    break;
                }
            }
        }

        dispatch(batchActions([
            {type: TeamTypes.RECEIVED_TEAM_DELETED, data: {id: deletedTeam.id}},
            {type: TeamTypes.UPDATED_TEAM, data: deletedTeam},
        ]));

        if (currentTeamId === deletedTeam.id) {
            if (newTeamId) {
                dispatch({type: TeamTypes.SELECT_TEAM, data: newTeamId});
                const globalState = getState();
                const redirectChannel = getRedirectChannelNameForTeam(globalState, newTeamId);
                getHistory().push(`${getCurrentTeamUrl(globalState)}/channels/${redirectChannel}`);
            } else {
                getHistory().push('/');
            }
        }
    }
}

/**
 * @param {import('@mattermost/client').TeamMemberRoleUpdatedMessage} msg
 */
function handleUpdateMemberRoleEvent(msg) {
    const memberData = JSON.parse(msg.data.member);
    const newRoles = memberData.roles.split(' ');

    dispatch(loadRolesIfNeeded(newRoles));

    dispatch({
        type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
        data: memberData,
    });
}

/**
 * @param {import('@mattermost/client').DirectChannelCreatedMessage} msg
 */
function handleDirectAddedEvent(msg) {
    return fetchChannelAndAddToSidebar(msg.broadcast.channel_id);
}

/**
 * @param {import('@mattermost/client').GroupChannelCreatedMessage} msg
 */
function handleGroupAddedEvent(msg) {
    return fetchChannelAndAddToSidebar(msg.broadcast.channel_id);
}

/**
 * @param {import('@mattermost/client').UserAddedToChannelMessage} msg
 */
function handleUserAddedEvent(msg) {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const config = getConfig(state);
        const license = getLicense(state);
        const currentChannelId = getCurrentChannelId(state);
        if (currentChannelId === msg.broadcast.channel_id) {
            doDispatch(getChannelStats(currentChannelId));
            doDispatch({
                type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                data: {id: msg.broadcast.channel_id, user_id: msg.data.user_id},
            });
            if (license?.IsLicensed === 'true' && license?.LDAPGroups === 'true' && config.EnableConfirmNotificationsToChannel === 'true') {
                doDispatch(getChannelMemberCountsByGroup(currentChannelId));
            }
        }

        // Load the channel so that it appears in the sidebar
        const currentUserId = getCurrentUserId(doGetState());
        if (currentUserId === msg.data.user_id) {
            doDispatch(fetchChannelAndAddToSidebar(msg.broadcast.channel_id));
        }

        // This event is fired when a user first joins the server, so refresh analytics to see if we're now over the user limit
        if (license.Cloud === 'true' && isCurrentUserSystemAdmin(doGetState())) {
            doDispatch(getStandardAnalytics());
        }

        if (msg.data.team_id && config.RestrictDirectMessage === 'team') {
            dispatch({type: ChannelTypes.RESTRICTED_DMS_TEAMS_CHANGED});
        }
    };
}

function fetchChannelAndAddToSidebar(channelId) {
    return async (doDispatch) => {
        const {data, error} = await doDispatch(getChannelAndMyMember(channelId));

        if (!error) {
            doDispatch(addChannelToInitialCategory(data.channel));
        }
    };
}

/**
 * @param {import('@mattermost/client').UserRemovedFromChannelMessage} msg
 */
export function handleUserRemovedEvent(msg) {
    const state = getState();
    const currentChannel = getCurrentChannel(state) || {};
    const currentUser = getCurrentUser(state);
    const config = getConfig(state);
    const license = getLicense(state);

    if (msg.broadcast.user_id === currentUser.id) {
        dispatch(loadChannelsForCurrentUser());

        const rhsChannelId = getSelectedChannelId(state);
        if (msg.data.channel_id === rhsChannelId) {
            dispatch(closeRightHandSide());
        }

        if (msg.data.channel_id === currentChannel.id) {
            if (msg.data.remover_id !== msg.broadcast.user_id) {
                const user = getUser(state, msg.data.remover_id);
                if (!user) {
                    dispatch(loadUser(msg.data.remover_id));
                }

                dispatch(openModal({
                    modalId: ModalIdentifiers.REMOVED_FROM_CHANNEL,
                    dialogType: RemovedFromChannelModal,
                    dialogProps: {
                        channelName: currentChannel.display_name,
                        removerId: msg.data.remover_id,
                    },
                }));
            }
        }

        const channel = getChannel(state, msg.data.channel_id);

        dispatch({
            type: ChannelTypes.LEAVE_CHANNEL,
            data: {
                id: msg.data.channel_id,
                user_id: msg.broadcast.user_id,
                team_id: channel?.team_id,
            },
        });

        if (msg.data.channel_id === currentChannel.id) {
            redirectUserToDefaultTeam();
        }

        if (isGuest(currentUser.roles)) {
            dispatch(removeNotVisibleUsers());
        }
    } else if (msg.broadcast.channel_id === currentChannel.id) {
        dispatch(getChannelStats(currentChannel.id));
        dispatch({
            type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
            data: {id: msg.broadcast.channel_id, user_id: msg.data.user_id},
        });
        if (license?.IsLicensed === 'true' && license?.LDAPGroups === 'true' && config.EnableConfirmNotificationsToChannel === 'true') {
            dispatch(getChannelMemberCountsByGroup(currentChannel.id));
        }
    }

    if (msg.broadcast.user_id !== currentUser.id) {
        const channel = getChannel(state, msg.broadcast.channel_id);
        const members = getChannelMembersInChannels(state);
        const isMember = Object.values(members).some((member) => member[msg.data.user_id]);
        if (channel && isGuest(currentUser.roles) && !isMember) {
            const actions = [
                {
                    type: UserTypes.PROFILE_NO_LONGER_VISIBLE,
                    data: {user_id: msg.data.user_id},
                },
                {
                    type: TeamTypes.REMOVE_MEMBER_FROM_TEAM,
                    data: {team_id: channel.team_id, user_id: msg.data.user_id},
                },
            ];
            dispatch(batchActions(actions));
        }
    }

    const channelId = msg.broadcast.channel_id || msg.data.channel_id;
    const userId = msg.broadcast.user_id || msg.data.user_id;
    const channel = getChannel(state, channelId);
    if (channel && !haveISystemPermission(state, {permission: Permissions.VIEW_MEMBERS}) && !haveITeamPermission(state, channel.team_id, Permissions.VIEW_MEMBERS)) {
        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM,
                data: {id: channel.team_id, user_id: userId},
            },
            {
                type: TeamTypes.REMOVE_MEMBER_FROM_TEAM,
                data: {team_id: channel.team_id, user_id: userId},
            },
        ]));
    }
}

/**
 * @param {import('@mattermost/client').UserUpdatedMessage} msg
 */
export async function handleUserUpdatedEvent(msg) {
    // This websocket event is sent to all non-guest users on the server, so be careful requesting data from the server
    // in response to it. That can overwhelm the server if every connected user makes such a request at the same time.
    // See https://mattermost.atlassian.net/browse/MM-40050 for more information.

    const state = getState();
    const currentUser = getCurrentUser(state);
    const user = msg.data.user;
    if (user && user.props) {
        const customStatus = user.props.customStatus ? JSON.parse(user.props.customStatus) : undefined;
        dispatch(loadCustomEmojisIfNeeded([customStatus?.emoji]));
    }

    if (currentUser.id === user.id) {
        if (user.update_at > currentUser.update_at) {
            // update user to unsanitized user data received from websocket message
            dispatch({
                type: UserTypes.RECEIVED_ME,
                data: user,
            });
            dispatch(loadRolesIfNeeded(user.roles.split(' ')));
        }
    } else {
        dispatch({
            type: UserTypes.RECEIVED_PROFILE,
            data: user,
        });
    }
}

/**
 * @param {import('@mattermost/client').ChannelSchemeUpdatedMessage} msg
 */
function handleChannelSchemeUpdatedEvent(msg) {
    dispatch(getMyChannelMember(msg.broadcast.channel_id));
}

/**
 * @param {import('@mattermost/client').RoleUpdatedMessage} msg
 */
function handleRoleUpdatedEvent(msg) {
    const role = JSON.parse(msg.data.role);

    dispatch({
        type: RoleTypes.RECEIVED_ROLE,
        data: role,
    });
}

/**
 * @param {import('@mattermost/client').ChannelCreatedMessage} msg
 */
function handleChannelCreatedEvent(msg) {
    return async (myDispatch, myGetState) => {
        const channelId = msg.data.channel_id;
        const teamId = msg.data.team_id;
        const state = myGetState();

        if (getCurrentTeamId(state) === teamId) {
            let channel = getChannel(state, channelId);

            if (!channel) {
                await myDispatch(getChannelAndMyMember(channelId));

                channel = getChannel(myGetState(), channelId);
            }

            myDispatch(addChannelToInitialCategory(channel, false));
        }
    };
}

/**
 * @param {import('@mattermost/client').ChannelDeletedMessage} msg
 */
function handleChannelDeletedEvent(msg) {
    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_DELETED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id, deleteAt: msg.data.delete_at, viewArchivedChannels: true}});
}

/**
 * @param {import('@mattermost/client').ChannelRestoredMessage} msg
 */
function handleChannelUnarchivedEvent(msg) {
    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_UNARCHIVED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id, viewArchivedChannels: true}});
}

/**
 * @param {import('@mattermost/client').PreferenceChangedMessage} msg
 */
function handlePreferenceChangedEvent(msg) {
    const preference = JSON.parse(msg.data.preference);
    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [preference]});

    if (addedNewDmUser(preference)) {
        loadProfilesForDM();
    }

    if (addedNewGmUser(preference)) {
        loadProfilesForGM();
    }
}

/**
 * @param {import('@mattermost/client').PreferencesChangedMessage} msg
 */
function handlePreferencesChangedEvent(msg) {
    const preferences = JSON.parse(msg.data.preferences);
    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: preferences});

    if (preferences.findIndex(addedNewDmUser) !== -1) {
        loadProfilesForDM();
    }

    if (preferences.findIndex(addedNewGmUser) !== -1) {
        loadProfilesForGM();
    }
}

/**
 * @param {import('@mattermost/client').PreferencesChangedMessage} msg
 */
function handlePreferencesDeletedEvent(msg) {
    const preferences = JSON.parse(msg.data.preferences);
    dispatch({type: PreferenceTypes.DELETED_PREFERENCES, data: preferences});
}

function addedNewDmUser(preference) {
    return preference.category === Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW && preference.value === 'true';
}

function addedNewGmUser(preference) {
    return preference.category === Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW && preference.value === 'true';
}

/**
 * @param {import('@mattermost/client').StatusChangedMessage} msg
 */
export function handleStatusChangedEvent(msg) {
    return {
        type: UserTypes.RECEIVED_STATUSES,
        data: {[msg.data.user_id]: msg.data.status},
    };
}

/**
 * @param {import('@mattermost/client').HelloMessage} msg
 */
function handleHelloEvent(msg) {
    dispatch(setServerVersion(msg.data.server_version));
    dispatch(setConnectionId(msg.data.connection_id));
    dispatch(setServerHostname(msg.data.server_hostname));
}

/**
 * @param {import('@mattermost/client').PostReactionMessage} msg
 */
function handleReactionAddedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    dispatch(getCustomEmojiForReaction(reaction.emoji_name));

    dispatch({
        type: PostTypes.RECEIVED_REACTION,
        data: reaction,
    });
}

function setConnectionId(connectionId) {
    return {
        type: GeneralTypes.SET_CONNECTION_ID,
        payload: {connectionId},
    };
}

function setServerHostname(serverHostname) {
    return {
        type: GeneralTypes.SET_SERVER_HOSTNAME,
        payload: {serverHostname},
    };
}

/**
 * @param {import('@mattermost/client').EmojiAddedMessage} msg
 */
function handleAddEmoji(msg) {
    const data = JSON.parse(msg.data.emoji);

    dispatch({
        type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        data,
    });
}

/**
 * @param {import('@mattermost/client').PostReactionMessage} msg
 */
function handleReactionRemovedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    dispatch({
        type: PostTypes.REACTION_DELETED,
        data: reaction,
    });
}

/**
 * @param {import('@mattermost/client').MultipleChannelsViewedMessage} msg
 */
function handleMultipleChannelsViewedEvent(msg) {
    if (getCurrentUserId(getState()) === msg.broadcast.user_id) {
        dispatch(markMultipleChannelsAsRead(msg.data.channel_times));
    }
}

/**
 * @param {import('@mattermost/client').PluginMessage} msg
 */
export function handlePluginEnabled(msg) {
    const manifest = msg.data.manifest;
    dispatch({type: ActionTypes.RECEIVED_WEBAPP_PLUGIN, data: manifest});

    loadPlugin(manifest).catch((error) => {
        console.error(error.message); //eslint-disable-line no-console
    });
}

/**
 * @param {import('@mattermost/client').PluginMessage} msg
 */
export function handlePluginDisabled(msg) {
    const manifest = msg.data.manifest;
    removePlugin(manifest);
}

/**
 * @param {import('@mattermost/client').UserRoleUpdatedMessage} msg
 */
function handleUserRoleUpdated(msg) {
    const user = store.getState().entities.users.profiles[msg.data.user_id];

    if (user) {
        const roles = msg.data.roles;
        const newRoles = roles.split(' ');
        const demoted = user.roles.includes(Constants.PERMISSIONS_SYSTEM_ADMIN) && !roles.includes(Constants.PERMISSIONS_SYSTEM_ADMIN);

        store.dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...user, roles}});
        dispatch(loadRolesIfNeeded(newRoles));

        if (demoted && global.location.pathname.startsWith('/admin_console')) {
            redirectUserToDefaultTeam();
        }
    }
}

/**
 * @param {import('@mattermost/client').ConfigChangedMessage} msg
 */
function handleConfigChanged(msg) {
    store.dispatch({type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data: msg.data.config});
}

/**
 * @param {import('@mattermost/client').LicenseChangedMessage} msg
 */
function handleLicenseChanged(msg) {
    store.dispatch({type: GeneralTypes.CLIENT_LICENSE_RECEIVED, data: msg.data.license});

    // Refresh server limits when license changes since limits may have changed
    dispatch(getServerLimits());
}

/**
 * @param {import('@mattermost/client').PluginStatusesChangedMessage} msg
 */
function handlePluginStatusesChangedEvent(msg) {
    store.dispatch({type: AdminTypes.RECEIVED_PLUGIN_STATUSES, data: msg.data.plugin_statuses});
}

/**
 * @param {import('@mattermost/client').OpenDialogMessage} msg
 */
function handleOpenDialogEvent(msg) {
    const data = (msg.data && msg.data.dialog) || {};
    const dialog = JSON.parse(data);

    store.dispatch({type: IntegrationTypes.RECEIVED_DIALOG, data: dialog});

    const currentTriggerId = getState().entities.integrations.dialogTriggerId;

    if (dialog.trigger_id !== currentTriggerId) {
        return;
    }

    store.dispatch(openModal({modalId: ModalIdentifiers.INTERACTIVE_DIALOG, dialogType: DialogRouter}));
}

/**
 * @param {import('@mattermost/client').ReceivedGroupMessage} msg
 */
function handleGroupUpdatedEvent(msg) {
    const data = JSON.parse(msg.data.group);
    dispatch(
        {
            type: GroupTypes.PATCHED_GROUP,
            data,
        },
    );
}

function handleMyGroupUpdate(groupMember) {
    dispatch(batchActions([
        {
            type: GroupTypes.ADD_MY_GROUP,
            id: groupMember.group_id,
        },
        {
            type: GroupTypes.RECEIVED_MEMBER_TO_ADD_TO_GROUP,
            data: groupMember,
            id: groupMember.group_id,
        },
        {
            type: UserTypes.RECEIVED_PROFILES_FOR_GROUP,
            data: [groupMember],
            id: groupMember.group_id,
        },
    ]));
}

/**
 * @param {import('@mattermost/client').GroupMemberMessage} msg
 */
export function handleGroupAddedMemberEvent(msg) {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const groupMember = JSON.parse(msg.data.group_member);

        if (currentUserId === groupMember.user_id) {
            const group = getGroup(state, groupMember.group_id);
            if (group) {
                handleMyGroupUpdate(groupMember);
            } else {
                const {error} = await doDispatch(fetchGroup(groupMember.group_id, true));
                if (!error) {
                    handleMyGroupUpdate(groupMember);
                }
            }
        }
    };
}

/**
 * @param {import('@mattermost/client').GroupMemberMessage} msg
 */
function handleGroupDeletedMemberEvent(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const data = JSON.parse(msg.data.group_member);

        if (currentUserId === data.user_id) {
            dispatch(batchActions([
                {
                    type: GroupTypes.REMOVE_MY_GROUP,
                    data,
                    id: data.group_id,
                },
                {
                    type: UserTypes.RECEIVED_PROFILES_LIST_TO_REMOVE_FROM_GROUP,
                    data: [data],
                    id: data.group_id,
                },
                {
                    type: GroupTypes.RECEIVED_MEMBER_TO_REMOVE_FROM_GROUP,
                    data,
                    id: data.group_id,
                },
            ]));
        }
    };
}

/**
 * @param {import('@mattermost/client').GroupAssociatedToTeamMessage} msg
 */
function handleGroupAssociatedToTeamEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_TEAM,
        data: {teamID: msg.broadcast.team_id, groups: [{id: msg.data.group_id}]},
    });
}

/**
 * @param {import('@mattermost/client').GroupAssociatedToTeamMessage} msg
 */
function handleGroupNotAssociatedToTeamEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_TEAM,
        data: {teamID: msg.broadcast.team_id, groups: [{id: msg.data.group_id}]},
    });
}

/**
 * @param {import('@mattermost/client').GroupAssociatedToChannelMessage} msg
 */
function handleGroupAssociatedToChannelEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL,
        data: {channelID: msg.broadcast.channel_id, groups: [{id: msg.data.group_id}]},
    });
}

/**
 * @param {import('@mattermost/client').GroupAssociatedToChannelMessage} msg
 */
function handleGroupNotAssociatedToChannelEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL,
        data: {channelID: msg.broadcast.channel_id, groups: [{id: msg.data.group_id}]},
    });
}

/**
 * @param {import('@mattermost/client').SidebarCategoryCreatedMessage} msg
 */
function handleSidebarCategoryCreated(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        if (!msg.broadcast.team_id) {
            return;
        }

        if (msg.broadcast.team_id !== getCurrentTeamId(state)) {
            // The new category will be loaded when we switch teams.
            return;
        }

        // Fetch all categories, including ones that weren't explicitly updated, in case any other categories had channels
        // moved out of them.
        doDispatch(fetchMyCategories(msg.broadcast.team_id));
    };
}

/**
 * @param {import('@mattermost/client').SidebarCategoryUpdatedMessage} msg
 */
function handleSidebarCategoryUpdated(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        if (!msg.broadcast.team_id) {
            return;
        }

        if (msg.broadcast.team_id !== getCurrentTeamId(state)) {
            // The updated categories will be loaded when we switch teams.
            return;
        }

        // Fetch all categories in case any other categories had channels moved out of them.
        // True indicates it is called from WebSocket
        doDispatch(fetchMyCategories(msg.broadcast.team_id, true));
    };
}

/**
 * @param {import('@mattermost/client').SidebarCategoryDeletedMessage} msg
 */
function handleSidebarCategoryDeleted(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        if (!msg.broadcast.team_id) {
            return;
        }

        if (msg.broadcast.team_id !== getCurrentTeamId(state)) {
            // The category will be removed when we switch teams.
            return;
        }

        // Fetch all categories since any channels that were in the deleted category were moved to other categories.
        doDispatch(fetchMyCategories(msg.broadcast.team_id));
    };
}

/**
 * @param {import('@mattermost/client').SidebarCategoryOrderUpdatedMessage} msg
 */
function handleSidebarCategoryOrderUpdated(msg) {
    return receivedCategoryOrder(msg.broadcast.team_id, msg.data.order);
}

/**
 * @param {import('@mattermost/client').UserActivationStatusChangedMessage} msg
 */
export function handleUserActivationStatusChange() {
    return (doDispatch, doGetState) => {
        const state = doGetState();
        const license = getLicense(state);

        // This event is fired when a user first joins the server, so refresh analytics to see if we're now over the user limit
        if (license.Cloud === 'true') {
            if (isCurrentUserSystemAdmin(state)) {
                doDispatch(getStandardAnalytics());
            }
        }
    };
}

/**
 * @param {import('@mattermost/client').CloudSubscriptionChangedMessage} msg
 */
export function handleCloudSubscriptionChanged(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();
        const license = getLicense(state);

        if (license.Cloud === 'true') {
            if (msg.data.limits) {
                doDispatch({
                    type: CloudTypes.RECEIVED_CLOUD_LIMITS,
                    data: msg.data.limits,
                });
            }

            if (msg.data.subscription) {
                doDispatch({
                    type: CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION,
                    data: msg.data.subscription,
                });
            }
        }
        return {data: true};
    };
}

function handleRefreshAppsBindings() {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        doDispatch(fetchAppBindings(getCurrentChannelId(state)));

        const siteURL = state.entities.general.config.SiteURL;
        const currentURL = window.location.href;
        let threadIdentifier;
        if (currentURL.startsWith(siteURL)) {
            const parts = currentURL.substr(siteURL.length + (siteURL.endsWith('/') ? 0 : 1)).split('/');
            if (parts.length === 3 && parts[1] === 'threads') {
                threadIdentifier = parts[2];
            }
        }
        const rhsPost = getSelectedPost(state);
        let selectedThread;
        if (threadIdentifier) {
            selectedThread = getThread(state, threadIdentifier);
        }
        const rootID = threadIdentifier || rhsPost?.id;
        const channelID = selectedThread?.post?.channel_id || rhsPost?.channel_id;
        if (!rootID) {
            return {data: true};
        }

        doDispatch(fetchRHSAppsBindings(channelID));
        return {data: true};
    };
}

export function handleAppsPluginEnabled() {
    dispatch(handleRefreshAppsBindings());

    return {
        type: AppsTypes.APPS_PLUGIN_ENABLED,
    };
}

export function handleAppsPluginDisabled() {
    return {
        type: AppsTypes.APPS_PLUGIN_DISABLED,
    };
}

/**
 * @param {import('@mattermost/client').FirstAdminVisitMarketplaceStatusReceivedMessage} msg
 */
function handleFirstAdminVisitMarketplaceStatusReceivedEvent(msg) {
    const receivedData = JSON.parse(msg.data.firstAdminVisitMarketplaceStatus);
    store.dispatch({type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, data: receivedData});
}

/**
 * @param {import('@mattermost/client').ThreadReadChangedMessage} msg
 */
function handleThreadReadChanged(msg) {
    return (doDispatch, doGetState) => {
        if (msg.data.thread_id) {
            const state = doGetState();
            const thread = getThreads(state)?.[msg.data.thread_id];

            // skip marking the thread as read (when the user is viewing the thread)
            if (thread && !isThreadOpen(state, thread.id)) {
                doDispatch(updateThreadLastOpened(thread.id, msg.data.timestamp));
            }

            doDispatch(
                handleReadChanged(
                    msg.data.thread_id,
                    msg.broadcast.team_id,
                    msg.data.channel_id,
                    {
                        lastViewedAt: msg.data.timestamp,
                        prevUnreadMentions: thread?.unread_mentions ?? msg.data.previous_unread_mentions,
                        newUnreadMentions: msg.data.unread_mentions,
                        prevUnreadReplies: thread?.unread_replies ?? msg.data.previous_unread_replies,
                        newUnreadReplies: msg.data.unread_replies,
                    },
                ),
            );
        } else if (msg.broadcast.channel_id) {
            doDispatch(handleAllThreadsInChannelMarkedRead(msg.broadcast.channel_id, msg.data.timestamp));
        } else {
            doDispatch(handleAllMarkedRead(msg.broadcast.team_id));
        }
    };
}

/**
 * @param {import('@mattermost/client').ThreadUpdatedMessage} msg
 */
function handleThreadUpdated(msg) {
    return (doDispatch, doGetState) => {
        let threadData;
        try {
            threadData = JSON.parse(msg.data.thread);
        } catch {
            // invalid JSON
            return;
        }

        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);

        let lastViewedAt;

        // if current user has replied to the thread
        // make sure to set following as true
        if (currentUserId === threadData.post.user_id) {
            threadData.is_following = true;
        }

        if (isThreadOpen(state, threadData.id) && window.isActive && !isThreadManuallyUnread(state, threadData.id)) {
            lastViewedAt = Date.now();

            // Sometimes `Date.now()` was generating a timestamp before the
            // last_reply_at of the thread, thus marking the thread as unread
            // instead of read. Here we set the timestamp to after the
            // last_reply_at if this happens.
            if (lastViewedAt < threadData.last_reply_at) {
                lastViewedAt = threadData.last_reply_at + 1;
            }

            // prematurely update thread data as read
            // so we won't flash the indicators when
            // we mark the thread as read on the server
            threadData.last_viewed_at = lastViewedAt;
            threadData.unread_mentions = 0;
            threadData.unread_replies = 0;

            // mark thread as read on the server
            dispatch(updateThreadRead(currentUserId, currentTeamId, threadData.id, lastViewedAt));
        }

        handleThreadArrived(doDispatch, doGetState, threadData, msg.broadcast.team_id, msg.data.previous_unread_replies, msg.data.previous_unread_mentions);
    };
}

/**
 * @param {import('@mattermost/client').ThreadFollowedChangedMessage} msg
 */
function handleThreadFollowChanged(msg) {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const thread = getThread(state, msg.data.thread_id);
        if (!thread && msg.data.state && msg.data.reply_count) {
            await doDispatch(fetchThread(getCurrentUserId(state), msg.broadcast.team_id, msg.data.thread_id, true));
        }
        handleFollowChanged(doDispatch, msg.data.thread_id, msg.broadcast.team_id, msg.data.state);
    };
}

/**
 * @param {import('@mattermost/client').PostAcknowledgementMessage} msg
 */
function handlePostAcknowledgementAdded(msg) {
    const data = JSON.parse(msg.data.acknowledgement);

    return {
        type: PostTypes.CREATE_ACK_POST_SUCCESS,
        data,
    };
}

/**
 * @param {import('@mattermost/client').PostAcknowledgementMessage} msg
 */
function handlePostAcknowledgementRemoved(msg) {
    const data = JSON.parse(msg.data.acknowledgement);

    return {
        type: PostTypes.DELETE_ACK_POST_SUCCESS,
        data,
    };
}

/**
 * @param {import('@mattermost/client').PostDraftMessage} msg
 */
function handleUpsertDraftEvent(msg) {
    return async (doDispatch) => {
        const draft = JSON.parse(msg.data.draft);
        const {key, value} = transformServerDraft(draft);
        value.show = true;

        doDispatch(setGlobalDraft(key, value, true));
    };
}

/**
 * @param {import('@mattermost/client').ScheduledPostMessage} msg
 */
function handleCreateScheduledPostEvent(msg) {
    return async (doDispatch) => {
        const scheduledPost = JSON.parse(msg.data.scheduledPost);
        const state = getState();
        const teamId = getTeamIdByChannelId(state, scheduledPost.channel_id);

        doDispatch({
            type: ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED,
            data: {
                scheduledPost,
                teamId,
            },
        });
    };
}

/**
 * @param {import('@mattermost/client').ScheduledPostMessage} msg
 */
function handleUpdateScheduledPostEvent(msg) {
    return async (doDispatch) => {
        const scheduledPost = JSON.parse(msg.data.scheduledPost);

        doDispatch({
            type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
            data: {
                scheduledPost,
            },
        });
    };
}

/**
 * @param {import('@mattermost/client').ScheduledPostMessage} msg
 */
function handleDeleteScheduledPostEvent(msg) {
    return async (doDispatch) => {
        const scheduledPost = JSON.parse(msg.data.scheduledPost);

        doDispatch({
            type: ScheduledPostTypes.SCHEDULED_POST_DELETED,
            data: {
                scheduledPost,
            },
        });
    };
}

/**
 * @param {import('@mattermost/client').PostDraftMessage} msg
 */
function handleDeleteDraftEvent(msg) {
    return async (doDispatch) => {
        const draft = JSON.parse(msg.data.draft);
        const {key} = transformServerDraft(draft);

        doDispatch(setGlobalItem(key, {
            message: '',
            fileInfos: [],
            uploadsInProgress: [],
        }));
    };
}

/**
 * @param {import('@mattermost/client').PersistentNotificationTriggeredMessage} msg
 */
function handlePersistentNotification(msg) {
    return async (doDispatch) => {
        const post = JSON.parse(msg.data.post);

        doDispatch(sendDesktopNotification(post, msg.data));
    };
}

/**
 * @param {import('@mattermost/client').HostedCustomerSignupProgressUpdatedMessage} msg
 */
function handleHostedCustomerSignupProgressUpdated(msg) {
    return {
        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
        data: msg.data.progress,
    };
}

/**
 * @param {import('@mattermost/client').ChannelBookmarkCreatedMessage} msg
 */
function handleChannelBookmarkCreated(msg) {
    const bookmark = JSON.parse(msg.data.bookmark);

    return {
        type: ChannelBookmarkTypes.RECEIVED_BOOKMARK,
        data: bookmark,
    };
}

/**
 * @param {import('@mattermost/client').ChannelBookmarkUpdatedMessage} msg
 */
function handleChannelBookmarkUpdated(msg) {
    return async (doDispatch) => {
        const {updated, deleted} = JSON.parse(msg.data.bookmarks);

        if (updated) {
            doDispatch({
                type: ChannelBookmarkTypes.RECEIVED_BOOKMARK,
                data: updated,
            });
        }

        if (deleted) {
            doDispatch({
                type: ChannelBookmarkTypes.BOOKMARK_DELETED,
                data: deleted,
            });
        }
    };
}

/**
 * @param {import('@mattermost/client').ChannelBookmarkDeletedMessage} msg
 */
function handleChannelBookmarkDeleted(msg) {
    const bookmark = JSON.parse(msg.data.bookmark);

    return {
        type: ChannelBookmarkTypes.BOOKMARK_DELETED,
        data: bookmark,
    };
}

/**
 * @param {import('@mattermost/client').ChannelBookmarkSortedMessage} msg
 */
function handleChannelBookmarkSorted(msg) {
    const bookmarks = JSON.parse(msg.data.bookmarks);

    return {
        type: ChannelBookmarkTypes.RECEIVED_BOOKMARKS,
        data: {channelId: msg.broadcast.channel_id, bookmarks},
    };
}

/**
 * @param {import('@mattermost/client').CPAValuesUpdatedMessage} msg
 */
export function handleCustomAttributeValuesUpdated(msg) {
    return {
        type: UserTypes.RECEIVED_CPA_VALUES,
        data: {userID: msg.data.user_id, customAttributeValues: msg.data.values},
    };
}

/**
 * @param {import('@mattermost/client').CPAFieldCreatedMessage} msg
 */
export function handleCustomAttributesCreated(msg) {
    return {
        type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_CREATED,
        data: msg.data.field,
    };
}

/**
 * @param {import('@mattermost/client').CPAFieldUpdatedMessage} msg
 */
export function handleCustomAttributesUpdated(msg) {
    return (dispatch) => {
        const {field, delete_values: deleteValues} = msg.data;

        // Check if server indicates values should be deleted
        if (deleteValues) {
            // Clear values for the field when type changes
            dispatch({
                type: UserTypes.CLEAR_CPA_VALUES,
                data: {fieldId: field.id},
            });
        }

        // Update the field
        dispatch({
            type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_PATCHED,
            data: field,
        });
    };
}

/**
 * @param {import('@mattermost/client').CPAFieldDeletedMessage} msg
 */
export function handleCustomAttributesDeleted(msg) {
    return {
        type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_DELETED,
        data: msg.data.field_id,
    };
}

/**
 * @param {import('@mattermost/client').ContentFlaggingReportValueUpdatedMessage} msg
 */
export function handleContentFlaggingReportValueChanged(msg) {
    return {
        type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
        data: msg.data,
    };
}
