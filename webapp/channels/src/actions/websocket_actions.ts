// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {batchActions} from 'redux-batched-actions';

import type {WebSocketMessage, WebSocketMessages} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';
import type {ChannelBookmarkWithFileInfo, UpdateChannelBookmarkResponse} from '@mattermost/types/channel_bookmarks';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {Draft} from '@mattermost/types/drafts';
import type {Emoji} from '@mattermost/types/emojis';
import type {Group, GroupMember} from '@mattermost/types/groups';
import type {OpenDialogRequest} from '@mattermost/types/integrations';
import type {Post, PostAcknowledgement} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {Reaction} from '@mattermost/types/reactions';
import type {Role} from '@mattermost/types/roles';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';

import type {MMReduxAction} from 'mattermost-redux/action_types';
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
    resetReloadPostsInChannel,
    resetReloadPostsInTranslatedChannels,
} from 'mattermost-redux/actions/posts';
import {getRecap} from 'mattermost-redux/actions/recaps';
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
    hasAutotranslationBecomeEnabled,
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

import {handlePostExpired} from 'actions/burn_on_read_deletion';
import {handleBurnOnReadPostRevealed, handleBurnOnReadAllRevealed} from 'actions/burn_on_read_websocket';
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
import {resetWsErrorCount} from 'actions/views/system';
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

import type {ActionFunc, ThunkActionFunc} from 'types/store';

import {temporarilySetPageLoadContext} from './telemetry_actions';

const dispatch = store.dispatch;
const getState = store.getState;

const MAX_WEBSOCKET_FAILS = 7;

const pluginEventHandlers: Record<string, Record<string, (msg: WebSocketMessages.Unknown) => void>> = {};

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
        const url = new URL(getSiteURL());

        // replace the protocol with a websocket one
        if (url.protocol === 'https:') {
            url.protocol = 'wss:';
        } else {
            url.protocol = 'ws:';
        }

        // append a port number if one isn't already specified
        if (!(/:\d+$/).test(url.host)) {
            if (url.protocol === 'wss:') {
                url.host += ':' + config.WebsocketSecurePort;
            } else {
                url.host += ':' + config.WebsocketPort;
            }
        }

        connUrl = url.toString();
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

const pluginReconnectHandlers: Record<string, () => void> = {};

export function registerPluginReconnectHandler(pluginId: string, handler: () => void) {
    pluginReconnectHandlers[pluginId] = handler;
}

export function unregisterPluginReconnectHandler(pluginId: string) {
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
        const mostRecentPost = mostRecentId && getPost(state, mostRecentId);

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

function syncThreads(teamId: string, userId: string) {
    const state = getState();
    const newestThread = getNewestThreadInTeam(state, teamId);

    // no need to sync if we have nothing yet
    if (!newestThread) {
        return;
    }
    dispatch(getCountsAndThreadsSince(userId, teamId, newestThread.last_reply_at));
}

export function registerPluginWebSocketEvent(pluginId: string, event: string, action: (msg: WebSocketMessages.Unknown) => void) {
    if (!pluginEventHandlers[pluginId]) {
        pluginEventHandlers[pluginId] = {};
    }
    pluginEventHandlers[pluginId][event] = action;
}

export function unregisterPluginWebSocketEvent(pluginId: string, event: string) {
    const events = pluginEventHandlers[pluginId];
    if (!events) {
        return;
    }

    Reflect.deleteProperty(events, event);
}

export function unregisterAllPluginWebSocketEvents(pluginId: string) {
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

function handleClose(failCount: number) {
    if (failCount > MAX_WEBSOCKET_FAILS) {
        dispatch(logError({type: 'critical', message: AnnouncementBarMessages.WEBSOCKET_PORT_ERROR}));
    }
    dispatch(batchActions([
        {
            type: GeneralTypes.WEBSOCKET_FAILURE,
            timestamp: Date.now(),
        },

        // TODO The accompanying logic causes the post textbox to turn yellow when there are WebSocket issues,
        // and it's been broken since https://github.com/mattermost/mattermost-webapp/pull/2981. Either this and the
        // batchActions should be removed, or we should fix this by changing incrementWsErrorCount to be a non-thunk
        // action.
        // incrementWsErrorCount(),
    ]));
}

export function handleEvent(msg: WebSocketMessage) {
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

    case WebSocketEvents.BurnOnReadPostRevealed:
        dispatch(handleBurnOnReadPostRevealed(msg.data));
        break;

    case WebSocketEvents.BurnOnReadPostBurned:
        dispatch(handlePostExpired(msg.data.post_id));
        break;

    case WebSocketEvents.BurnOnReadPostAllRevealed:
        dispatch(handleBurnOnReadAllRevealed(msg.data));
        break;

    case WebSocketEvents.LeaveTeam:
        handleLeaveTeamEvent(msg);
        break;

    case WebSocketEvents.UpdateTeam:
        handleUpdateTeamEvent(msg);
        break;

    case WebSocketEvents.UpdateTeamScheme:
        handleUpdateTeamSchemeEvent();
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
        dispatch(handleChannelMemberUpdatedEvent(msg));
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
    case WebSocketEvents.PostTranslationUpdated:
        dispatch(handlePostTranslationUpdated(msg));
        break;
    case WebSocketEvents.RecapUpdated:
        dispatch(handleRecapUpdated(msg));
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
function handleChannelConvertedEvent(msg: WebSocketMessages.ChannelConverted) {
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

export function handleChannelUpdatedEvent(msg: WebSocketMessages.ChannelUpdated): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        if (!msg.data.channel) {
            return;
        }

        const channel = JSON.parse(msg.data.channel) as Channel;

        const actions: MMReduxAction[] = [{type: ChannelTypes.RECEIVED_CHANNEL, data: channel}];

        // handling the case of GM converted to private channel.
        const state = doGetState();
        const existingChannel = getChannel(state, channel.id);

        // if the updated channel exists in store
        if (existingChannel) {
            // and it was a GM, converted to a private channel
            if (existingChannel.type === General.GM_CHANNEL && channel.type === General.PRIVATE_CHANNEL) {
                actions.push({type: ChannelTypes.GM_CONVERTED_TO_CHANNEL, data: channel});
            }

            if (hasAutotranslationBecomeEnabled(state, channel)) {
                doDispatch(resetReloadPostsInChannel(channel.id));
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

function handleChannelMemberUpdatedEvent(msg: WebSocketMessages.ChannelMemberUpdated): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        const channelMember = JSON.parse(msg.data.channelMember) as ChannelMembership;
        const roles = channelMember.roles.split(' ');
        doDispatch(loadRolesIfNeeded(roles));

        const state = doGetState();
        const becameEnabled = hasAutotranslationBecomeEnabled(state, channelMember);

        doDispatch({type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER, data: channelMember});

        if (becameEnabled) {
            doDispatch(resetReloadPostsInChannel(channelMember.channel_id));
        }
    };
}

function debouncePostEvent(wait: number) {
    let timeout: number | undefined;
    let queue: Array<WebSocketMessages.Posted | WebSocketMessages.EphemeralPost> = [];
    let count = 0;

    // Called when timeout triggered
    const triggered = () => {
        timeout = undefined;

        if (queue.length > 0) {
            dispatch(handleNewPostEvents(queue));
        }

        queue = [];
        count = 0;
    };

    return function fx(msg: WebSocketMessages.Posted | WebSocketMessages.EphemeralPost) {
        if (timeout && count > 4) {
            // If the timeout is going this is the second or further event so queue them up.
            if (queue.push(msg) > 200) {
                // Don't run us out of memory, give up if the queue gets insane
                queue = [];
                console.log('channel broken because of too many incoming messages'); //eslint-disable-line no-console
            }
            clearTimeout(timeout);
            timeout = window.setTimeout(triggered, wait);
        } else {
            // Apply immediately for events up until count reaches limit
            count += 1;
            dispatch(handleNewPostEvent(msg));
            clearTimeout(timeout);
            timeout = window.setTimeout(triggered, wait);
        }
    };
}

const handleNewPostEventDebounced = debouncePostEvent(100);

export function handleNewPostEvent(msg: WebSocketMessages.Posted | WebSocketMessages.EphemeralPost): ThunkActionFunc<void> {
    return (myDispatch, myGetState) => {
        const post = JSON.parse(msg.data.post) as Post;

        if ((window as any).logPostEvents) {
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
            'set_online' in msg.data && msg.data.set_online
        ) {
            myDispatch({
                type: UserTypes.RECEIVED_STATUSES,
                data: {[post.user_id]: UserStatuses.ONLINE},
            });
        }
    };
}

export function handleNewPostEvents(queue: Array<WebSocketMessages.Posted | WebSocketMessages.EphemeralPost>): ThunkActionFunc<void> {
    return (myDispatch, myGetState) => {
        // Note that this method doesn't properly update the sidebar state for these posts
        const posts = queue.map((msg) => JSON.parse(msg.data.post) as Post);

        if ((window as any).logPostEvents) {
            // eslint-disable-next-line no-console
            console.log('handleNewPostEvents - new posts received', posts);
        }

        posts.forEach((post, index) => {
            const msg = queue[index];
            if ('should_ack' in msg.data && msg.data.should_ack) {
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

export function handlePostEditEvent(msg: WebSocketMessages.PostEdited) {
    // Store post
    const post = JSON.parse(msg.data.post) as Post;

    if ((window as any).logPostEvents) {
        // eslint-disable-next-line no-console
        console.log('handlePostEditEvent - post edit received', post);
    }

    const crtEnabled = isCollapsedThreadsEnabled(getState());
    dispatch(receivedPost(post, crtEnabled));

    dispatch(batchFetchStatusesProfilesGroupsFromPosts([post]));
}

async function handlePostDeleteEvent(msg: WebSocketMessages.PostDeleted) {
    const post = JSON.parse(msg.data.post) as Post;

    if ((window as any).logPostEvents) {
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

export function handlePostUnreadEvent(msg: WebSocketMessages.PostUnread) {
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

async function handleTeamAddedEvent(msg: WebSocketMessages.UserAddedToTeam) {
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

export function handleLeaveTeamEvent(msg: WebSocketMessages.UserRemovedFromTeam) {
    const state = getState();

    const actions: MMReduxAction[] = [
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
        // Include channel IDs so reducers can clean up posts/embeds for those channels
        dispatch({type: TeamTypes.LEAVE_TEAM, data: {id: msg.data.team_id, channelIds: channels}});

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

function handleUpdateTeamEvent(msg: WebSocketMessages.Team) {
    const state = store.getState();
    const license = getLicense(state);
    dispatch({type: TeamTypes.UPDATED_TEAM, data: JSON.parse(msg.data.team) as Team});
    if (license.Cloud === 'true') {
        dispatch(getTeamsUsage());
    }
}

function handleUpdateTeamSchemeEvent() {
    dispatch(TeamActions.getMyTeamMembers());
}

function handleDeleteTeamEvent(msg: WebSocketMessages.Team) {
    const deletedTeam = JSON.parse(msg.data.team) as Team;
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
            const myTeams: Record<string, Team> = {};
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

function handleUpdateMemberRoleEvent(msg: WebSocketMessages.TeamMemberRoleUpdated) {
    const memberData = JSON.parse(msg.data.member) as TeamMembership;
    const newRoles = memberData.roles.split(' ');

    dispatch(loadRolesIfNeeded(newRoles));

    dispatch({
        type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
        data: memberData,
    });
}

function handleDirectAddedEvent(msg: WebSocketMessages.DirectChannelCreated) {
    return fetchChannelAndAddToSidebar(msg.broadcast.channel_id);
}

function handleGroupAddedEvent(msg: WebSocketMessages.GroupChannelCreated) {
    return fetchChannelAndAddToSidebar(msg.broadcast.channel_id);
}

function handleUserAddedEvent(msg: WebSocketMessages.UserAddedToChannel): ThunkActionFunc<void> {
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

function fetchChannelAndAddToSidebar(channelId: string): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const {data, error} = await doDispatch(getChannelAndMyMember(channelId));

        if (data && !error) {
            doDispatch(addChannelToInitialCategory(data.channel));
        }
    };
}

export function handleUserRemovedEvent(msg: WebSocketMessages.UserRemovedFromChannel) {
    const state = getState();
    const currentChannel = getCurrentChannel(state);
    const currentUser = getCurrentUser(state);
    const config = getConfig(state);
    const license = getLicense(state);

    if (msg.broadcast.user_id === currentUser.id) {
        dispatch(loadChannelsForCurrentUser());

        const rhsChannelId = getSelectedChannelId(state);
        if (msg.data.channel_id === rhsChannelId) {
            dispatch(closeRightHandSide());
        }

        if (currentChannel && msg.data.channel_id === currentChannel.id) {
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

        const channel = getChannel(state, msg.data.channel_id ?? '');

        dispatch({
            type: ChannelTypes.LEAVE_CHANNEL,
            data: {
                id: msg.data.channel_id,
                user_id: msg.broadcast.user_id,
                team_id: channel?.team_id,
            },
        });

        if (currentChannel && msg.data.channel_id === currentChannel.id) {
            redirectUserToDefaultTeam();
        }

        if (isGuest(currentUser.roles)) {
            dispatch(removeNotVisibleUsers());
        }
    } else if (currentChannel && msg.broadcast.channel_id === currentChannel.id) {
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
        const isMember = Object.values(members).some((member) => msg.data.user_id && member[msg.data.user_id]);
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

    const channelId = msg.broadcast.channel_id || msg.data.channel_id || '';
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

export async function handleUserUpdatedEvent(msg: WebSocketMessages.UserUpdated) {
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
        const autotranslationIsEnabled = getConfig(state)?.EnableAutoTranslation === 'true';
        if (autotranslationIsEnabled && user.locale !== currentUser.locale) {
            dispatch(resetReloadPostsInTranslatedChannels());
        }
    } else {
        dispatch({
            type: UserTypes.RECEIVED_PROFILE,
            data: user,
        });
    }
}

function handleChannelSchemeUpdatedEvent(msg: WebSocketMessages.ChannelSchemeUpdated) {
    dispatch(getMyChannelMember(msg.broadcast.channel_id));
}

function handleRoleUpdatedEvent(msg: WebSocketMessages.RoleUpdated) {
    const role = JSON.parse(msg.data.role) as Role;

    dispatch({
        type: RoleTypes.RECEIVED_ROLE,
        data: role,
    });
}

function handleChannelCreatedEvent(msg: WebSocketMessages.ChannelCreated): ThunkActionFunc<void> {
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

            if (!channel) {
                return;
            }

            myDispatch(addChannelToInitialCategory(channel, false));
        }
    };
}

function handleChannelDeletedEvent(msg: WebSocketMessages.ChannelDeleted) {
    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_DELETED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id, deleteAt: msg.data.delete_at, viewArchivedChannels: true}});
}

function handleChannelUnarchivedEvent(msg: WebSocketMessages.ChannelRestored) {
    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_UNARCHIVED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id, viewArchivedChannels: true}});
}

function handlePreferenceChangedEvent(msg: WebSocketMessages.PreferenceChanged) {
    const preference = JSON.parse(msg.data.preference) as PreferenceType;
    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [preference]});

    if (addedNewDmUser(preference)) {
        loadProfilesForDM();
    }

    if (addedNewGmUser(preference)) {
        loadProfilesForGM();
    }
}

function handlePreferencesChangedEvent(msg: WebSocketMessages.PreferencesChanged) {
    const preferences = JSON.parse(msg.data.preferences) as PreferenceType[];
    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: preferences});

    if (preferences.findIndex(addedNewDmUser) !== -1) {
        loadProfilesForDM();
    }

    if (preferences.findIndex(addedNewGmUser) !== -1) {
        loadProfilesForGM();
    }
}

function handlePreferencesDeletedEvent(msg: WebSocketMessages.PreferencesChanged) {
    const preferences = JSON.parse(msg.data.preferences) as PreferenceType[];
    dispatch({type: PreferenceTypes.DELETED_PREFERENCES, data: preferences});
}

function addedNewDmUser(preference: PreferenceType) {
    return preference.category === Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW && preference.value === 'true';
}

function addedNewGmUser(preference: PreferenceType) {
    return preference.category === Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW && preference.value === 'true';
}

export function handleStatusChangedEvent(msg: WebSocketMessages.StatusChanged) {
    return {
        type: UserTypes.RECEIVED_STATUSES,
        data: {[msg.data.user_id]: msg.data.status},
    };
}

function handleHelloEvent(msg: WebSocketMessages.Hello) {
    dispatch(setServerVersion(msg.data.server_version));
    dispatch(setConnectionId(msg.data.connection_id));
    dispatch(setServerHostname(msg.data.server_hostname));
}

function handleReactionAddedEvent(msg: WebSocketMessages.PostReaction) {
    const reaction = JSON.parse(msg.data.reaction) as Reaction;

    dispatch(getCustomEmojiForReaction(reaction.emoji_name));

    dispatch({
        type: PostTypes.RECEIVED_REACTION,
        data: reaction,
    });
}

function setConnectionId(connectionId: string) {
    return {
        type: GeneralTypes.SET_CONNECTION_ID,
        payload: {connectionId},
    };
}

function setServerHostname(serverHostname: string | undefined) {
    return {
        type: GeneralTypes.SET_SERVER_HOSTNAME,
        payload: {serverHostname},
    };
}

function handleAddEmoji(msg: WebSocketMessages.EmojiAdded) {
    const data = JSON.parse(msg.data.emoji) as Emoji;

    dispatch({
        type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        data,
    });
}

function handleReactionRemovedEvent(msg: WebSocketMessages.PostReaction) {
    const reaction = JSON.parse(msg.data.reaction) as Reaction;

    dispatch({
        type: PostTypes.REACTION_DELETED,
        data: reaction,
    });
}

function handleMultipleChannelsViewedEvent(msg: WebSocketMessages.MultipleChannelsViewed) {
    if (getCurrentUserId(getState()) === msg.broadcast.user_id) {
        dispatch(markMultipleChannelsAsRead(msg.data.channel_times));
    }
}

export function handlePluginEnabled(msg: WebSocketMessages.Plugin) {
    const manifest = msg.data.manifest;
    dispatch({type: ActionTypes.RECEIVED_WEBAPP_PLUGIN, data: manifest});

    loadPlugin(manifest).catch((error) => {
        console.error(error.message); //eslint-disable-line no-console
    });
}

export function handlePluginDisabled(msg: WebSocketMessages.Plugin) {
    const manifest = msg.data.manifest;
    removePlugin(manifest);
}

function handleUserRoleUpdated(msg: WebSocketMessages.UserRoleUpdated) {
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

function handleConfigChanged(msg: WebSocketMessages.ConfigChanged) {
    const state = getState();
    const currentConfig = getConfig(state);
    const newConfig = msg.data.config;

    // Check if EnableAutoTranslation changed from enabled to disabled
    const enableAutoTranslationWasEnabled = currentConfig?.EnableAutoTranslation === 'true';
    const enableAutoTranslationIsEnabled = newConfig?.EnableAutoTranslation === 'true';

    if (!enableAutoTranslationWasEnabled && enableAutoTranslationIsEnabled) {
        dispatch(resetReloadPostsInTranslatedChannels());
    }

    store.dispatch({type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data: newConfig});
}

function handleLicenseChanged(msg: WebSocketMessages.LicenseChanged) {
    store.dispatch({type: GeneralTypes.CLIENT_LICENSE_RECEIVED, data: msg.data.license});

    // Refresh server limits when license changes since limits may have changed
    dispatch(getServerLimits());
}

function handlePluginStatusesChangedEvent(msg: WebSocketMessages.PluginStatusesChanged) {
    store.dispatch({type: AdminTypes.RECEIVED_PLUGIN_STATUSES, data: msg.data.plugin_statuses});
}

function handleOpenDialogEvent(msg: WebSocketMessages.OpenDialog) {
    const data = (msg.data && msg.data.dialog);
    const dialog = JSON.parse(data) as OpenDialogRequest || {};

    store.dispatch({type: IntegrationTypes.RECEIVED_DIALOG, data: dialog});

    const currentTriggerId = getState().entities.integrations.dialogTriggerId;

    if (dialog.trigger_id !== currentTriggerId) {
        return;
    }

    store.dispatch(openModal({modalId: ModalIdentifiers.INTERACTIVE_DIALOG, dialogType: DialogRouter}));
}

function handleGroupUpdatedEvent(msg: WebSocketMessages.ReceivedGroup) {
    const data = JSON.parse(msg.data.group) as Group;
    dispatch(
        {
            type: GroupTypes.PATCHED_GROUP,
            data,
        },
    );
}

function handleMyGroupUpdate(groupMember: GroupMember) {
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

export function handleGroupAddedMemberEvent(msg: WebSocketMessages.GroupMember): ThunkActionFunc<void> {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const groupMember = JSON.parse(msg.data.group_member) as GroupMember;

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

function handleGroupDeletedMemberEvent(msg: WebSocketMessages.GroupMember): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        const state = doGetState();
        const currentUserId = getCurrentUserId(state);
        const data = JSON.parse(msg.data.group_member) as GroupMember;

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

function handleGroupAssociatedToTeamEvent(msg: WebSocketMessages.GroupAssociatedToTeam) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_TEAM,
        data: {teamID: msg.broadcast.team_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleGroupNotAssociatedToTeamEvent(msg: WebSocketMessages.GroupAssociatedToTeam) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_TEAM,
        data: {teamID: msg.broadcast.team_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleGroupAssociatedToChannelEvent(msg: WebSocketMessages.GroupAssociatedToChannel) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL,
        data: {channelID: msg.broadcast.channel_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleGroupNotAssociatedToChannelEvent(msg: WebSocketMessages.GroupAssociatedToChannel) {
    store.dispatch({
        type: GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL,
        data: {channelID: msg.broadcast.channel_id, groups: [{id: msg.data.group_id}]},
    });
}

function handleSidebarCategoryCreated(msg: WebSocketMessages.SidebarCategoryCreated): ThunkActionFunc<void> {
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

function handleSidebarCategoryUpdated(msg: WebSocketMessages.SidebarCategoryUpdated): ThunkActionFunc<void> {
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

function handleSidebarCategoryDeleted(msg: WebSocketMessages.SidebarCategoryDeleted): ThunkActionFunc<void> {
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

function handleSidebarCategoryOrderUpdated(msg: WebSocketMessages.SidebarCategoryOrderUpdated) {
    return receivedCategoryOrder(msg.broadcast.team_id, msg.data.order);
}

export function handleUserActivationStatusChange(): ThunkActionFunc<void> {
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

export function handleCloudSubscriptionChanged(msg: WebSocketMessages.CloudSubscriptionChanged): ActionFunc<boolean> {
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

function handleRefreshAppsBindings(): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        const state = doGetState();

        doDispatch(fetchAppBindings(getCurrentChannelId(state)));

        const siteURL = state.entities.general.config.SiteURL;
        const currentURL = window.location.href;
        let threadIdentifier;
        if (siteURL && currentURL.startsWith(siteURL)) {
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

function handleFirstAdminVisitMarketplaceStatusReceivedEvent(msg: WebSocketMessages.FirstAdminVisitMarketplaceStatusReceived) {
    const receivedData = JSON.parse(msg.data.firstAdminVisitMarketplaceStatus) as boolean;
    store.dispatch({type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, data: receivedData});
}

function handleThreadReadChanged(msg: WebSocketMessages.ThreadReadChanged): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        if (msg.data.thread_id && msg.data.channel_id && msg.data.unread_mentions && msg.data.unread_replies) {
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

function handleThreadUpdated(msg: WebSocketMessages.ThreadUpdated): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        let threadData;
        try {
            threadData = JSON.parse(msg.data.thread) as UserThread;
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

function handleThreadFollowChanged(msg: WebSocketMessages.ThreadFollowedChanged): ThunkActionFunc<void> {
    return async (doDispatch, doGetState) => {
        const state = doGetState();
        const thread = getThread(state, msg.data.thread_id);
        if (!thread && msg.data.state && msg.data.reply_count) {
            await doDispatch(fetchThread(getCurrentUserId(state), msg.broadcast.team_id, msg.data.thread_id, true));
        }
        handleFollowChanged(doDispatch, msg.data.thread_id, msg.broadcast.team_id, msg.data.state);
    };
}

function handlePostAcknowledgementAdded(msg: WebSocketMessages.PostAcknowledgement) {
    const data = JSON.parse(msg.data.acknowledgement) as PostAcknowledgement;

    return {
        type: PostTypes.CREATE_ACK_POST_SUCCESS,
        data,
    };
}

function handlePostAcknowledgementRemoved(msg: WebSocketMessages.PostAcknowledgement) {
    const data = JSON.parse(msg.data.acknowledgement) as PostAcknowledgement;

    return {
        type: PostTypes.DELETE_ACK_POST_SUCCESS,
        data,
    };
}

function handleUpsertDraftEvent(msg: WebSocketMessages.PostDraft): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const draft = JSON.parse(msg.data.draft) as Draft;
        const {key, value} = transformServerDraft(draft);
        value.show = true;

        doDispatch(setGlobalDraft(key, value, true));
    };
}

function handleCreateScheduledPostEvent(msg: WebSocketMessages.ScheduledPost): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const scheduledPost = JSON.parse(msg.data.scheduledPost) as ScheduledPost;
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

function handleUpdateScheduledPostEvent(msg: WebSocketMessages.ScheduledPost): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const scheduledPost = JSON.parse(msg.data.scheduledPost) as ScheduledPost;

        doDispatch({
            type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
            data: {
                scheduledPost,
            },
        });
    };
}

function handleDeleteScheduledPostEvent(msg: WebSocketMessages.ScheduledPost): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const scheduledPost = JSON.parse(msg.data.scheduledPost) as ScheduledPost;

        doDispatch({
            type: ScheduledPostTypes.SCHEDULED_POST_DELETED,
            data: {
                scheduledPost,
            },
        });
    };
}

function handleDeleteDraftEvent(msg: WebSocketMessages.PostDraft): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const draft = JSON.parse(msg.data.draft) as Draft;
        const {key} = transformServerDraft(draft);

        doDispatch(setGlobalItem(key, {
            message: '',
            fileInfos: [],
            uploadsInProgress: [],
        }));
    };
}

function handlePersistentNotification(msg: WebSocketMessages.PersistentNotificationTriggered): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const post = JSON.parse(msg.data.post) as Post;

        doDispatch(sendDesktopNotification(post, msg.data));
    };
}

function handleChannelBookmarkCreated(msg: WebSocketMessages.ChannelBookmarkCreated) {
    const bookmark = JSON.parse(msg.data.bookmark) as ChannelBookmarkWithFileInfo;

    return {
        type: ChannelBookmarkTypes.RECEIVED_BOOKMARK,
        data: bookmark,
    };
}

function handleChannelBookmarkUpdated(msg: WebSocketMessages.ChannelBookmarkUpdated): ThunkActionFunc<void> {
    return async (doDispatch) => {
        const {updated, deleted} = JSON.parse(msg.data.bookmarks) as UpdateChannelBookmarkResponse;

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

function handleChannelBookmarkDeleted(msg: WebSocketMessages.ChannelBookmarkDeleted) {
    const bookmark = JSON.parse(msg.data.bookmark) as ChannelBookmarkWithFileInfo;

    return {
        type: ChannelBookmarkTypes.BOOKMARK_DELETED,
        data: bookmark,
    };
}

function handleChannelBookmarkSorted(msg: WebSocketMessages.ChannelBookmarkSorted) {
    const bookmarks = JSON.parse(msg.data.bookmarks) as ChannelBookmarkWithFileInfo[];

    return {
        type: ChannelBookmarkTypes.RECEIVED_BOOKMARKS,
        data: {channelId: msg.broadcast.channel_id, bookmarks},
    };
}

export function handleCustomAttributeValuesUpdated(msg: WebSocketMessages.CPAValuesUpdated) {
    return {
        type: UserTypes.RECEIVED_CPA_VALUES,
        data: {userID: msg.data.user_id, customAttributeValues: msg.data.values},
    };
}

export function handleCustomAttributesCreated(msg: WebSocketMessages.CPAFieldCreated) {
    return {
        type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_CREATED,
        data: msg.data.field,
    };
}

export function handleCustomAttributesUpdated(msg: WebSocketMessages.CPAFieldUpdated): ThunkActionFunc<void> {
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

export function handleCustomAttributesDeleted(msg: WebSocketMessages.CPAFieldDeleted) {
    return {
        type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_DELETED,
        data: msg.data.field_id,
    };
}

export function handleContentFlaggingReportValueChanged(msg: WebSocketMessages.ContentFlaggingReportValueUpdated) {
    return {
        type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
        data: msg.data,
    };
}

export function handlePostTranslationUpdated(msg: WebSocketMessages.PostTranslationUpdated) {
    return {
        type: PostTypes.POST_TRANSLATION_UPDATED,
        data: msg.data,
    };
}

export function handleRecapUpdated(msg: WebSocketMessages.RecapUpdated): ThunkActionFunc<void> {
    const recapId = msg.data.recap_id;

    return async (doDispatch) => {
        // Fetch the updated recap and dispatch to Redux
        doDispatch(getRecap(recapId));
    };
}
