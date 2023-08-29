// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {batchActions} from 'redux-batched-actions';

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
    HostedCustomerTypes,
} from 'mattermost-redux/action_types';
import {General, Permissions} from 'mattermost-redux/constants';
import {addChannelToInitialCategory, fetchMyCategories, receivedCategoryOrder} from 'mattermost-redux/actions/channel_categories';
import {
    getChannelAndMyMember,
    getMyChannelMember,
    getChannelStats,
    markMultipleChannelsAsRead,
    getChannelMemberCountsByGroup,
} from 'mattermost-redux/actions/channels';
import {getCloudSubscription} from 'mattermost-redux/actions/cloud';
import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';

import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getNewestThreadInTeam, getThread, getThreads} from 'mattermost-redux/selectors/entities/threads';
import {getGroup} from 'mattermost-redux/selectors/entities/groups';
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

import {setServerVersion, getClientConfig} from 'mattermost-redux/actions/general';
import {
    getCustomEmojiForReaction,
    getPosts,
    getPostThread,
    getMentionsAndStatusesForPosts,
    getThreadsForPosts,
    postDeleted,
    receivedNewPost,
    receivedPost,
} from 'mattermost-redux/actions/posts';
import {clearErrors, logError} from 'mattermost-redux/actions/errors';

import * as TeamActions from 'mattermost-redux/actions/teams';
import {
    checkForModifiedUsers,
    getUser as loadUser,
} from 'mattermost-redux/actions/users';
import {getGroup as fetchGroup} from 'mattermost-redux/actions/groups';
import {removeNotVisibleUsers} from 'mattermost-redux/actions/websocket';
import {setGlobalItem} from 'actions/storage';
import {setGlobalDraft, transformServerDraft} from 'actions/views/drafts';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUser, getCurrentUserId, getUser, getIsManualStatusForUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {
    getMyTeams,
    getCurrentRelativeTeamUrl,
    getCurrentTeamId,
    getCurrentTeamUrl,
    getTeam,
    getRelativeTeamUrl,
} from 'mattermost-redux/selectors/entities/teams';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {
    getChannel,
    getChannelMembersInChannels,
    getChannelsInTeam,
    getCurrentChannel,
    getCurrentChannelId,
    getRedirectChannelNameForTeam,
} from 'mattermost-redux/selectors/entities/channels';
import {getPost, getMostRecentPostIdInChannel, getTeamIdFromPost} from 'mattermost-redux/selectors/entities/posts';
import {haveISystemPermission, haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {appsFeatureFlagEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getStandardAnalytics} from 'mattermost-redux/actions/admin';

import {fetchAppBindings, fetchRHSAppsBindings} from 'mattermost-redux/actions/apps';

import {getSelectedChannelId, getSelectedPost} from 'selectors/rhs';
import {isThreadOpen, isThreadManuallyUnread} from 'selectors/views/threads';

import {openModal} from 'actions/views/modals';
import {incrementWsErrorCount, resetWsErrorCount} from 'actions/views/system';
import {closeRightHandSide} from 'actions/views/rhs';
import {syncPostsInChannel} from 'actions/views/channel';
import {updateThreadLastOpened} from 'actions/views/threads';

import {getHistory} from 'utils/browser_history';
import {loadChannelsForCurrentUser} from 'actions/channel_actions';
import {loadCustomEmojisIfNeeded} from 'actions/emoji_actions';
import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {handleNewPost} from 'actions/post_actions';
import * as StatusActions from 'actions/status_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {sendDesktopNotification} from 'actions/notification_actions.jsx';
import store from 'stores/redux_store.jsx';
import WebSocketClient from 'client/web_websocket_client.jsx';
import {loadPlugin, loadPluginsIfNecessary, removePlugin} from 'plugins';
import {ActionTypes, Constants, AnnouncementBarMessages, SocketEvents, UserStatuses, ModalIdentifiers, WarnMetricTypes} from 'utils/constants';
import {getSiteURL} from 'utils/url';
import {isGuest} from 'mattermost-redux/utils/user_utils';
import RemovedFromChannelModal from 'components/removed_from_channel_modal';
import InteractiveDialog from 'components/interactive_dialog';
import {
    getTeamsUsage,
} from 'actions/cloud';

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

    WebSocketClient.initialize(connUrl);
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

        if (appsFeatureFlagEnabled(state)) {
            dispatch(handleRefreshAppsBindings());
        }

        dispatch(loadChannelsForCurrentUser());

        if (mostRecentPost) {
            dispatch(syncPostsInChannel(currentChannelId, mostRecentPost.create_at));
        } else if (currentChannelId) {
            // if network timed-out the first time when loading a channel
            // we can request for getPosts again when socket is connected
            dispatch(getPosts(currentChannelId));
        }
        dispatch(StatusActions.loadStatusesForChannelAndSidebar());

        const crtEnabled = isCollapsedThreadsEnabled(state);
        dispatch(TeamActions.getMyTeamUnreads(crtEnabled, true));
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
    }

    loadPluginsIfNecessary();

    Object.values(pluginReconnectHandlers).forEach((handler) => {
        if (handler && typeof handler === 'function') {
            handler();
        }
    });

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

export function handleEvent(msg) {
    switch (msg.event) {
    case SocketEvents.POSTED:
    case SocketEvents.EPHEMERAL_MESSAGE:
        handleNewPostEventDebounced(msg);
        break;

    case SocketEvents.POST_EDITED:
        handlePostEditEvent(msg);
        break;

    case SocketEvents.POST_DELETED:
        handlePostDeleteEvent(msg);
        break;

    case SocketEvents.POST_UNREAD:
        handlePostUnreadEvent(msg);
        break;

    case SocketEvents.LEAVE_TEAM:
        handleLeaveTeamEvent(msg);
        break;

    case SocketEvents.UPDATE_TEAM:
        handleUpdateTeamEvent(msg);
        break;

    case SocketEvents.UPDATE_TEAM_SCHEME:
        handleUpdateTeamSchemeEvent(msg);
        break;

    case SocketEvents.DELETE_TEAM:
        handleDeleteTeamEvent(msg);
        break;

    case SocketEvents.ADDED_TO_TEAM:
        handleTeamAddedEvent(msg);
        break;

    case SocketEvents.USER_ADDED:
        dispatch(handleUserAddedEvent(msg));
        break;

    case SocketEvents.USER_REMOVED:
        handleUserRemovedEvent(msg);
        break;

    case SocketEvents.USER_UPDATED:
        handleUserUpdatedEvent(msg);
        break;

    case SocketEvents.ROLE_ADDED:
        handleRoleAddedEvent(msg);
        break;

    case SocketEvents.ROLE_REMOVED:
        handleRoleRemovedEvent(msg);
        break;

    case SocketEvents.CHANNEL_SCHEME_UPDATED:
        handleChannelSchemeUpdatedEvent(msg);
        break;

    case SocketEvents.MEMBERROLE_UPDATED:
        handleUpdateMemberRoleEvent(msg);
        break;

    case SocketEvents.ROLE_UPDATED:
        handleRoleUpdatedEvent(msg);
        break;

    case SocketEvents.CHANNEL_CREATED:
        dispatch(handleChannelCreatedEvent(msg));
        break;

    case SocketEvents.CHANNEL_DELETED:
        handleChannelDeletedEvent(msg);
        break;

    case SocketEvents.CHANNEL_UNARCHIVED:
        handleChannelUnarchivedEvent(msg);
        break;

    case SocketEvents.CHANNEL_CONVERTED:
        handleChannelConvertedEvent(msg);
        break;

    case SocketEvents.CHANNEL_UPDATED:
        dispatch(handleChannelUpdatedEvent(msg));
        break;

    case SocketEvents.CHANNEL_MEMBER_UPDATED:
        handleChannelMemberUpdatedEvent(msg);
        break;

    case SocketEvents.DIRECT_ADDED:
        dispatch(handleDirectAddedEvent(msg));
        break;

    case SocketEvents.GROUP_ADDED:
        dispatch(handleGroupAddedEvent(msg));
        break;

    case SocketEvents.PREFERENCE_CHANGED:
        handlePreferenceChangedEvent(msg);
        break;

    case SocketEvents.PREFERENCES_CHANGED:
        handlePreferencesChangedEvent(msg);
        break;

    case SocketEvents.PREFERENCES_DELETED:
        handlePreferencesDeletedEvent(msg);
        break;

    case SocketEvents.STATUS_CHANGED:
        handleStatusChangedEvent(msg);
        break;

    case SocketEvents.HELLO:
        handleHelloEvent(msg);
        break;

    case SocketEvents.REACTION_ADDED:
        handleReactionAddedEvent(msg);
        break;

    case SocketEvents.REACTION_REMOVED:
        handleReactionRemovedEvent(msg);
        break;

    case SocketEvents.EMOJI_ADDED:
        handleAddEmoji(msg);
        break;

    case SocketEvents.MULTIPLE_CHANNELS_VIEWED:
        handleMultipleChannelsViewedEvent(msg);
        break;

    case SocketEvents.PLUGIN_ENABLED:
        handlePluginEnabled(msg);
        break;

    case SocketEvents.PLUGIN_DISABLED:
        handlePluginDisabled(msg);
        break;

    case SocketEvents.USER_ROLE_UPDATED:
        handleUserRoleUpdated(msg);
        break;

    case SocketEvents.CONFIG_CHANGED:
        handleConfigChanged(msg);
        break;

    case SocketEvents.LICENSE_CHANGED:
        handleLicenseChanged(msg);
        break;

    case SocketEvents.PLUGIN_STATUSES_CHANGED:
        handlePluginStatusesChangedEvent(msg);
        break;

    case SocketEvents.OPEN_DIALOG:
        handleOpenDialogEvent(msg);
        break;

    case SocketEvents.RECEIVED_GROUP:
        handleGroupUpdatedEvent(msg);
        break;

    case SocketEvents.GROUP_MEMBER_ADD:
        dispatch(handleGroupAddedMemberEvent(msg));
        break;

    case SocketEvents.GROUP_MEMBER_DELETED:
        dispatch(handleGroupDeletedMemberEvent(msg));
        break;

    case SocketEvents.RECEIVED_GROUP_ASSOCIATED_TO_TEAM:
        handleGroupAssociatedToTeamEvent(msg);
        break;

    case SocketEvents.RECEIVED_GROUP_NOT_ASSOCIATED_TO_TEAM:
        handleGroupNotAssociatedToTeamEvent(msg);
        break;

    case SocketEvents.RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL:
        handleGroupAssociatedToChannelEvent(msg);
        break;

    case SocketEvents.RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL:
        handleGroupNotAssociatedToChannelEvent(msg);
        break;

    case SocketEvents.WARN_METRIC_STATUS_RECEIVED:
        handleWarnMetricStatusReceivedEvent(msg);
        break;

    case SocketEvents.WARN_METRIC_STATUS_REMOVED:
        handleWarnMetricStatusRemovedEvent(msg);
        break;

    case SocketEvents.SIDEBAR_CATEGORY_CREATED:
        dispatch(handleSidebarCategoryCreated(msg));
        break;

    case SocketEvents.SIDEBAR_CATEGORY_UPDATED:
        dispatch(handleSidebarCategoryUpdated(msg));
        break;

    case SocketEvents.SIDEBAR_CATEGORY_DELETED:
        dispatch(handleSidebarCategoryDeleted(msg));
        break;
    case SocketEvents.SIDEBAR_CATEGORY_ORDER_UPDATED:
        dispatch(handleSidebarCategoryOrderUpdated(msg));
        break;
    case SocketEvents.USER_ACTIVATION_STATUS_CHANGED:
        dispatch(handleUserActivationStatusChange());
        break;
    case SocketEvents.CLOUD_PAYMENT_STATUS_UPDATED:
        dispatch(handleCloudPaymentStatusUpdated(msg));
        break;
    case SocketEvents.CLOUD_SUBSCRIPTION_CHANGED:
        dispatch(handleCloudSubscriptionChanged(msg));
        break;
    case SocketEvents.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED:
        handleFirstAdminVisitMarketplaceStatusReceivedEvent(msg);
        break;
    case SocketEvents.THREAD_FOLLOW_CHANGED:
        dispatch(handleThreadFollowChanged(msg));
        break;
    case SocketEvents.THREAD_READ_CHANGED:
        dispatch(handleThreadReadChanged(msg));
        break;
    case SocketEvents.THREAD_UPDATED:
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
    case SocketEvents.POST_ACKNOWLEDGEMENT_ADDED:
        dispatch(handlePostAcknowledgementAdded(msg));
        break;
    case SocketEvents.POST_ACKNOWLEDGEMENT_REMOVED:
        dispatch(handlePostAcknowledgementRemoved(msg));
        break;
    case SocketEvents.DRAFT_CREATED:
    case SocketEvents.DRAFT_UPDATED:
        dispatch(handleUpsertDraftEvent(msg));
        break;
    case SocketEvents.DRAFT_DELETED:
        dispatch(handleDeleteDraftEvent(msg));
        break;
    case SocketEvents.PERSISTENT_NOTIFICATION_TRIGGERED:
        dispatch(handlePersistentNotification(msg));
        break;
    case SocketEvents.HOSTED_CUSTOMER_SIGNUP_PROGRESS_UPDATED:
        dispatch(handleHostedCustomerSignupProgressUpdated(msg));
        break;
    default:
    }

    Object.values(pluginEventHandlers).forEach((pluginEvents) => {
        if (!pluginEvents) {
            return;
        }

        if (pluginEvents.hasOwnProperty(msg.event) && typeof pluginEvents[msg.event] === 'function') {
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

        doDispatch({type: ChannelTypes.RECEIVED_CHANNEL, data: channel});

        const state = doGetState();
        if (channel.id === getCurrentChannelId(state)) {
            getHistory().replace(`${getRelativeTeamUrl(state, channel.team_id)}/channels/${channel.name}`);
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

export function handleNewPostEvent(msg) {
    return (myDispatch, myGetState) => {
        const post = JSON.parse(msg.data.post);

        if (window.logPostEvents) {
            // eslint-disable-next-line no-console
            console.log('handleNewPostEvent - new post received', post);
        }

        myDispatch(handleNewPost(post, msg));

        getMentionsAndStatusesForPosts([post], myDispatch, myGetState);

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
                data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
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

        // Receive the posts as one continuous block since they were received within a short period
        const crtEnabled = isCollapsedThreadsEnabled(myGetState());
        const actions = posts.map((post) => receivedNewPost(post, crtEnabled));
        myDispatch(batchActions(actions));

        // Load the posts' threads
        myDispatch(getThreadsForPosts(posts));

        // And any other data needed for them
        getMentionsAndStatusesForPosts(posts, myDispatch, myGetState);
    };
}

export function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.data.post);

    if (window.logPostEvents) {
        // eslint-disable-next-line no-console
        console.log('handlePostEditEvent - post edit received', post);
    }

    const crtEnabled = isCollapsedThreadsEnabled(getState());
    dispatch(receivedPost(post, crtEnabled));

    getMentionsAndStatusesForPosts([post], dispatch, getState);
}

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
            const {order, posts} = res.data;
            const rootPost = posts[order[0]];
            dispatch(receivedPost(rootPost));
        }
    }

    if (post.is_pinned) {
        dispatch(getChannelStats(post.channel_id));
    }
}

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

async function handleTeamAddedEvent(msg) {
    await dispatch(TeamActions.getTeam(msg.data.team_id));
    await dispatch(TeamActions.getMyTeamMembers());
    const state = getState();
    await dispatch(TeamActions.getMyTeamUnreads(isCollapsedThreadsEnabled(state)));
    const license = getLicense(state);
    if (license.Cloud === 'true') {
        dispatch(getTeamsUsage());
    }
}

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

function handleUpdateTeamEvent(msg) {
    const state = store.getState();
    const license = getLicense(state);
    dispatch({type: TeamTypes.UPDATED_TEAM, data: JSON.parse(msg.data.team)});
    if (license.Cloud === 'true') {
        dispatch(getTeamsUsage());
    }
}

function handleUpdateTeamSchemeEvent() {
    dispatch(TeamActions.getMyTeamMembers());
}

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

function handleUpdateMemberRoleEvent(msg) {
    const memberData = JSON.parse(msg.data.member);
    const newRoles = memberData.roles.split(' ');

    dispatch(loadRolesIfNeeded(newRoles));

    dispatch({
        type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
        data: memberData,
    });
}

function handleDirectAddedEvent(msg) {
    return fetchChannelAndAddToSidebar(msg.broadcast.channel_id);
}

function handleGroupAddedEvent(msg) {
    return fetchChannelAndAddToSidebar(msg.broadcast.channel_id);
}

function handleUserAddedEvent(msg) {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const config = getConfig(state);
        const license = getLicense(state);
        const isTimezoneEnabled = config.ExperimentalTimezone === 'true';
        const currentChannelId = getCurrentChannelId(state);
        if (currentChannelId === msg.broadcast.channel_id) {
            doDispatch(getChannelStats(currentChannelId));
            doDispatch({
                type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
                data: {id: msg.broadcast.channel_id, user_id: msg.data.user_id},
            });
            if (license?.IsLicensed === 'true' && license?.LDAPGroups === 'true' && config.EnableConfirmNotificationsToChannel === 'true') {
                doDispatch(getChannelMemberCountsByGroup(currentChannelId, isTimezoneEnabled));
            }
        }

        // Load the channel so that it appears in the sidebar
        const currentTeamId = getCurrentTeamId(doGetState());
        const currentUserId = getCurrentUserId(doGetState());
        if (currentTeamId === msg.data.team_id && currentUserId === msg.data.user_id) {
            doDispatch(fetchChannelAndAddToSidebar(msg.broadcast.channel_id));
        }

        // This event is fired when a user first joins the server, so refresh analytics to see if we're now over the user limit
        if (license.Cloud === 'true' && isCurrentUserSystemAdmin(doGetState())) {
            doDispatch(getStandardAnalytics());
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

export function handleUserRemovedEvent(msg) {
    const state = getState();
    const currentChannel = getCurrentChannel(state) || {};
    const currentUser = getCurrentUser(state);
    const config = getConfig(state);
    const license = getLicense(state);
    const isTimezoneEnabled = config.ExperimentalTimezone === 'true';

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
            dispatch(getChannelMemberCountsByGroup(currentChannel.id, isTimezoneEnabled));
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
            // update user to unsanitized user data recieved from websocket message
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

function handleRoleAddedEvent(msg) {
    const role = JSON.parse(msg.data.role);

    dispatch({
        type: RoleTypes.RECEIVED_ROLE,
        data: role,
    });
}

function handleRoleRemovedEvent(msg) {
    const role = JSON.parse(msg.data.role);

    dispatch({
        type: RoleTypes.ROLE_DELETED,
        data: role,
    });
}

function handleChannelSchemeUpdatedEvent(msg) {
    dispatch(getMyChannelMember(msg.broadcast.channel_id));
}

function handleRoleUpdatedEvent(msg) {
    const role = JSON.parse(msg.data.role);

    dispatch({
        type: RoleTypes.RECEIVED_ROLE,
        data: role,
    });
}

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

function handleChannelDeletedEvent(msg) {
    const state = getState();
    const config = getConfig(state);
    const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';
    if (getCurrentChannelId(state) === msg.data.channel_id && !viewArchivedChannels) {
        const teamUrl = getCurrentRelativeTeamUrl(state);
        const currentTeamId = getCurrentTeamId(state);
        const redirectChannel = getRedirectChannelNameForTeam(state, currentTeamId);
        getHistory().push(teamUrl + '/channels/' + redirectChannel);
    }

    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_DELETED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id, deleteAt: msg.data.delete_at, viewArchivedChannels}});
}

function handleChannelUnarchivedEvent(msg) {
    const state = getState();
    const config = getConfig(state);
    const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';

    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_UNARCHIVED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id, viewArchivedChannels}});
}

function handlePreferenceChangedEvent(msg) {
    const preference = JSON.parse(msg.data.preference);
    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [preference]});

    if (addedNewDmUser(preference)) {
        loadProfilesForSidebar();
    }
}

function handlePreferencesChangedEvent(msg) {
    const preferences = JSON.parse(msg.data.preferences);
    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: preferences});

    if (preferences.findIndex(addedNewDmUser) !== -1) {
        loadProfilesForSidebar();
    }
}

function handlePreferencesDeletedEvent(msg) {
    const preferences = JSON.parse(msg.data.preferences);
    dispatch({type: PreferenceTypes.DELETED_PREFERENCES, data: preferences});
}

function addedNewDmUser(preference) {
    return preference.category === Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW && preference.value === 'true';
}

function handleStatusChangedEvent(msg) {
    dispatch({
        type: UserTypes.RECEIVED_STATUSES,
        data: [{user_id: msg.data.user_id, status: msg.data.status}],
    });
}

function handleHelloEvent(msg) {
    setServerVersion(msg.data.server_version)(dispatch, getState);
    dispatch(setConnectionId(msg.data.connection_id));
}

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

function handleAddEmoji(msg) {
    const data = JSON.parse(msg.data.emoji);

    dispatch({
        type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        data,
    });
}

function handleReactionRemovedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    dispatch({
        type: PostTypes.REACTION_DELETED,
        data: reaction,
    });
}

function handleMultipleChannelsViewedEvent(msg) {
    if (getCurrentUserId(getState()) === msg.broadcast.user_id) {
        dispatch(markMultipleChannelsAsRead(msg.data.channel_times));
    }
}

export function handlePluginEnabled(msg) {
    const manifest = msg.data.manifest;
    dispatch({type: ActionTypes.RECEIVED_WEBAPP_PLUGIN, data: manifest});

    loadPlugin(manifest).catch((error) => {
        console.error(error.message); //eslint-disable-line no-console
    });
}

export function handlePluginDisabled(msg) {
    const manifest = msg.data.manifest;
    removePlugin(manifest);
}

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

function handleConfigChanged(msg) {
    store.dispatch({type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data: msg.data.config});
}

function handleLicenseChanged(msg) {
    store.dispatch({type: GeneralTypes.CLIENT_LICENSE_RECEIVED, data: msg.data.license});
}

function handlePluginStatusesChangedEvent(msg) {
    store.dispatch({type: AdminTypes.RECEIVED_PLUGIN_STATUSES, data: msg.data.plugin_statuses});
}

function handleOpenDialogEvent(msg) {
    const data = (msg.data && msg.data.dialog) || {};
    const dialog = JSON.parse(data);

    store.dispatch({type: IntegrationTypes.RECEIVED_DIALOG, data: dialog});

    const currentTriggerId = getState().entities.integrations.dialogTriggerId;

    if (dialog.trigger_id !== currentTriggerId) {
        return;
    }

    store.dispatch(openModal({modalId: ModalIdentifiers.INTERACTIVE_DIALOG, dialogType: InteractiveDialog}));
}

function handleGroupUpdatedEvent(msg) {
    const data = JSON.parse(msg.data.group);
    dispatch(
        {
            type: GroupTypes.PATCHED_GROUP,
            data,
        },
    );
}

export function handleGroupAddedMemberEvent(msg) {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const groupInfo = JSON.parse(msg.data.group_member);

        if (currentUserId === groupInfo.user_id) {
            const group = getGroup(state, groupInfo.group_id);
            if (group) {
                dispatch(
                    {
                        type: GroupTypes.ADD_MY_GROUP,
                        id: groupInfo.group_id,
                    },
                );
            } else {
                const {error} = await doDispatch(fetchGroup(groupInfo.group_id, true));
                if (!error) {
                    dispatch(
                        {
                            type: GroupTypes.ADD_MY_GROUP,
                            id: groupInfo.group_id,
                        },
                    );
                }
            }
        }
    };
}

function handleGroupDeletedMemberEvent(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const data = JSON.parse(msg.data.group_member);

        if (currentUserId === data.user_id) {
            dispatch(
                {
                    type: GroupTypes.REMOVE_MY_GROUP,
                    data,
                    id: data.group_id,
                },
            );
        }
    };
}

function handleGroupAssociatedToTeamEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_TEAM,
        data: {teamID: msg.broadcast.team_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleGroupNotAssociatedToTeamEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_TEAM,
        data: {teamID: msg.broadcast.team_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleGroupAssociatedToChannelEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL,
        data: {channelID: msg.broadcast.channel_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleGroupNotAssociatedToChannelEvent(msg) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL,
        data: {channelID: msg.broadcast.channel_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleWarnMetricStatusReceivedEvent(msg) {
    var receivedData = JSON.parse(msg.data.warnMetricStatus);
    let bannerData;
    if (receivedData.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500) {
        bannerData = AnnouncementBarMessages.WARN_METRIC_STATUS_NUMBER_OF_USERS;
    } else if (receivedData.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M) {
        bannerData = AnnouncementBarMessages.WARN_METRIC_STATUS_NUMBER_OF_POSTS;
    }
    store.dispatch(batchActions([
        {
            type: GeneralTypes.WARN_METRIC_STATUS_RECEIVED,
            data: receivedData,
        },
        {
            type: ActionTypes.SHOW_NOTICE,
            data: [bannerData],
        },
    ]));
}

function handleWarnMetricStatusRemovedEvent(msg) {
    store.dispatch({type: GeneralTypes.WARN_METRIC_STATUS_REMOVED, data: {id: msg.data.warnMetricId}});
}

function handleSidebarCategoryCreated(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        if (msg.broadcast.team_id !== getCurrentTeamId(state)) {
            // The new category will be loaded when we switch teams.
            return;
        }

        // Fetch all categories, including ones that weren't explicitly updated, in case any other categories had channels
        // moved out of them.
        doDispatch(fetchMyCategories(msg.broadcast.team_id));
    };
}

function handleSidebarCategoryUpdated(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        if (msg.broadcast.team_id !== getCurrentTeamId(state)) {
            // The updated categories will be loaded when we switch teams.
            return;
        }

        // Fetch all categories in case any other categories had channels moved out of them.
        // True indicates it is called from WebSocket
        doDispatch(fetchMyCategories(msg.broadcast.team_id, true));
    };
}

function handleSidebarCategoryDeleted(msg) {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        if (msg.broadcast.team_id !== getCurrentTeamId(state)) {
            // The category will be removed when we switch teams.
            return;
        }

        // Fetch all categories since any channels that were in the deleted category were moved to other categories.
        doDispatch(fetchMyCategories(msg.broadcast.team_id));
    };
}

function handleSidebarCategoryOrderUpdated(msg) {
    return receivedCategoryOrder(msg.broadcast.team_id, msg.data.order);
}

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

function handleCloudPaymentStatusUpdated() {
    return (doDispatch) => doDispatch(getCloudSubscription());
}

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

function handleFirstAdminVisitMarketplaceStatusReceivedEvent(msg) {
    const receivedData = JSON.parse(msg.data.firstAdminVisitMarketplaceStatus);
    store.dispatch({type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, data: receivedData});
}

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
            handleAllThreadsInChannelMarkedRead(doDispatch, doGetState, msg.broadcast.channel_id, msg.data.timestamp);
        } else {
            handleAllMarkedRead(doDispatch, msg.broadcast.team_id);
        }
    };
}

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

        if (isThreadOpen(state, threadData.id) && !isThreadManuallyUnread(state, threadData.id)) {
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

function handlePostAcknowledgementAdded(msg) {
    const data = JSON.parse(msg.data.acknowledgement);

    return {
        type: PostTypes.CREATE_ACK_POST_SUCCESS,
        data,
    };
}

function handlePostAcknowledgementRemoved(msg) {
    const data = JSON.parse(msg.data.acknowledgement);

    return {
        type: PostTypes.DELETE_ACK_POST_SUCCESS,
        data,
    };
}

function handleUpsertDraftEvent(msg) {
    return async (doDispatch) => {
        const draft = JSON.parse(msg.data.draft);
        const {key, value} = transformServerDraft(draft);
        value.show = true;

        doDispatch(setGlobalDraft(key, value, true));
    };
}

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

function handlePersistentNotification(msg) {
    return async (doDispatch) => {
        const post = JSON.parse(msg.data.post);

        doDispatch(sendDesktopNotification(post, msg.data));
    };
}

function handleHostedCustomerSignupProgressUpdated(msg) {
    return {
        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
        data: msg.data.progress,
    };
}
