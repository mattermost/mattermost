// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import * as ChannelUtils from 'utils/channel_utils.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';

import {loadProfilesForSidebar, loadNewDMIfNeeded, loadNewGMIfNeeded} from 'actions/user_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import {Constants, Preferences} from 'utils/constants.jsx';

import {browserHistory} from 'react-router/es6';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import * as ChannelActions from 'mattermost-redux/actions/channels';
import {savePreferences, deletePreferences} from 'mattermost-redux/actions/preferences';
import {Client4} from 'mattermost-redux/client';

import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';

export function goToChannel(channel) {
    if (channel.fake) {
        const user = UserStore.getProfileByUsername(channel.display_name);
        if (!user) {
            return;
        }
        openDirectChannelToUser(
            user.id,
            () => {
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
            },
            null
        );
    } else {
        browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
    }
}

export function executeCommand(message, args, success, error) {
    let msg = message;

    let cmdLength = msg.indexOf(' ');
    if (cmdLength < 0) {
        cmdLength = msg.length;
    }
    const cmd = msg.substring(0, cmdLength).toLowerCase();
    msg = cmd + msg.substring(cmdLength, msg.length);

    switch (cmd) {
    case '/search':
        PostActions.searchForTerm(msg.substring(cmdLength + 1, msg.length));
        return;
    case '/shortcuts':
        if (UserAgent.isMobile()) {
            const err = {message: Utils.localizeMessage('create_post.shortcutsNotSupported', 'Keyboard shortcuts are not supported on your device')};
            error(err);
            return;
        }

        GlobalActions.showShortcutsModal();
        return;
    case '/leave': {
        // /leave command not supported in reply threads.
        if (args.channel_id && (args.root_id || args.parent_id)) {
            GlobalActions.sendEphemeralPost('/leave is not supported in reply threads. Use it in the center channel instead.', args.channel_id, args.parent_id);
            return;
        }
        const channel = ChannelStore.getCurrent();
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            GlobalActions.showLeavePrivateChannelModal(channel);
            return;
        } else if (
            channel.type === Constants.DM_CHANNEL ||
            channel.type === Constants.GM_CHANNEL
        ) {
            let name;
            let category;
            if (channel.type === Constants.DM_CHANNEL) {
                name = Utils.getUserIdFromChannelName(channel);
                category = Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;
            } else {
                name = channel.id;
                category = Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW;
            }
            const currentUserId = UserStore.getCurrentId();
            savePreferences(currentUserId, [{category, name, user_id: currentUserId, value: 'false'}])(dispatch, getState);
            if (ChannelUtils.isFavoriteChannel(channel)) {
                unmarkFavorite(channel.id);
            }
            browserHistory.push(`${TeamStore.getCurrentTeamRelativeUrl()}/channels/town-square`);
            return;
        }
        break;
    }
    case '/settings':
        GlobalActions.showAccountSettingsModal();
        return;
    }

    Client4.executeCommand(msg, args).then(success).catch(
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function setChannelAsRead(channelIdParam) {
    const channelId = channelIdParam || ChannelStore.getCurrentId();
    ChannelActions.viewChannel(channelId)(dispatch, getState);
    ChannelStore.resetCounts([channelId]);
    ChannelStore.emitChange();
    if (channelId === ChannelStore.getCurrentId()) {
        ChannelStore.emitLastViewed(Number.MAX_VALUE, false);
    }
}

export function addUserToChannel(channelId, userId, success, error) {
    ChannelActions.addChannelMember(channelId, userId)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.addChannelMember.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function removeUserFromChannel(channelId, userId, success, error) {
    ChannelActions.removeChannelMember(channelId, userId)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.removeChannelMember.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function makeUserChannelAdmin(channelId, userId, success, error) {
    ChannelActions.updateChannelMemberRoles(channelId, userId, 'channel_user channel_admin')(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.updateChannelMember.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function makeUserChannelMember(channelId, userId, success, error) {
    ChannelActions.updateChannelMemberRoles(channelId, userId, 'channel_user')(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.updateChannelMember.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function openDirectChannelToUser(userId, success, error) {
    const channelName = Utils.getDirectChannelName(UserStore.getCurrentId(), userId);
    const channel = ChannelStore.getByName(channelName);

    if (channel) {
        trackEvent('api', 'api_channels_join_direct');
        PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
        loadProfilesForSidebar();

        const currentUserId = UserStore.getCurrentId();
        savePreferences(currentUserId, [{user_id: currentUserId, category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: userId, value: 'true'}])(dispatch, getState);

        if (success) {
            success(channel, true);
        }

        return;
    }

    ChannelActions.createDirectChannel(UserStore.getCurrentId(), userId)(dispatch, getState).then(
        (result) => {
            loadProfilesForSidebar();
            if (result.data && success) {
                success(result.data, false);
            } else if (result.error && error) {
                error({id: result.error.server_error_id, ...result.error});
            }
        }
    );
}

export function openGroupChannelToUsers(userIds, success, error) {
    ChannelActions.createGroupChannel(userIds)(dispatch, getState).then(
        (result) => {
            loadProfilesForSidebar();
            if (result.data && success) {
                success(result.data, false);
            } else if (result.error && error) {
                browserHistory.push(TeamStore.getCurrentTeamUrl());
                error({id: result.error.server_error_id, ...result.error});
            }
        }
    );
}

export function markFavorite(channelId) {
    trackEvent('api', 'api_channels_favorited');
    const currentUserId = UserStore.getCurrentId();
    savePreferences(currentUserId, [{user_id: currentUserId, category: Preferences.CATEGORY_FAVORITE_CHANNEL, name: channelId, value: 'true'}])(dispatch, getState);
}

export function unmarkFavorite(channelId) {
    trackEvent('api', 'api_channels_unfavorited');
    const currentUserId = UserStore.getCurrentId();

    const pref = {
        user_id: currentUserId,
        category: Preferences.CATEGORY_FAVORITE_CHANNEL,
        name: channelId
    };

    deletePreferences(currentUserId, [pref])(dispatch, getState);
}

export function loadChannelsForCurrentUser() {
    ChannelActions.fetchMyChannelsAndMembers(TeamStore.getCurrentId())(dispatch, getState).then(
        () => {
            loadDMsAndGMsForUnreads();
        }
    );
}

export function loadDMsAndGMsForUnreads() {
    const unreads = ChannelStore.getUnreadCounts();
    for (const id in unreads) {
        if (!unreads.hasOwnProperty(id)) {
            continue;
        }

        if (unreads[id].msgs > 0 || unreads[id].mentions > 0) {
            const channel = ChannelStore.get(id);
            if (channel && channel.type === Constants.DM_CHANNEL) {
                loadNewDMIfNeeded(channel.id);
            } else if (channel && channel.type === Constants.GM_CHANNEL) {
                loadNewGMIfNeeded(channel.id);
            }
        }
    }
}

export async function joinChannel(channel, success, error) {
    const {data, serverError} = await ChannelActions.joinChannel(UserStore.getCurrentId(), null, channel.id)(dispatch, getState);

    if (data && success) {
        success(data);
    } else if (data == null && error) {
        error({id: serverError.server_error_id, ...serverError});
    }
}

export function updateChannel(channel, success, error) {
    ChannelActions.updateChannel(channel)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.updateChannel.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function searchMoreChannels(term, success, error) {
    ChannelActions.searchChannels(TeamStore.getCurrentId(), term)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                const myMembers = getMyChannelMemberships(getState());
                const channels = data.filter((c) => !myMembers[c.id]);
                success(channels);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.getChannels.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function autocompleteChannels(term, success, error) {
    ChannelActions.searchChannels(TeamStore.getCurrentId(), term)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.getChannels.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateChannelNotifyProps(data, options, success, error) {
    ChannelActions.updateChannelNotifyProps(data.user_id, data.channel_id, Object.assign({}, data, options))(dispatch, getState).then(
        (result) => {
            if (result && success) {
                success(result);
            } else if (result == null && error) {
                const serverError = getState().requests.channels.updateChannelNotifyProps.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function createChannel(channel, success, error) {
    ChannelActions.createChannel(channel)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.createChannel.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateChannelPurpose(channelId, purpose, success, error) {
    ChannelActions.patchChannel(channelId, {purpose})(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.updateChannel.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateChannelHeader(channelId, header, success, error) {
    ChannelActions.patchChannel(channelId, {header})(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.updateChannel.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function getChannelMembersForUserIds(channelId, userIds, success, error) {
    ChannelActions.getChannelMembersByIds(channelId, userIds)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.members.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function leaveChannel(channelId, success) {
    ChannelActions.leaveChannel(channelId)(dispatch, getState).then(
        () => {
            if (ChannelUtils.isFavoriteChannelId(channelId)) {
                unmarkFavorite(channelId);
            }

            const townsquare = ChannelStore.getByName('town-square');
            browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + townsquare.name);

            if (success) {
                success();
            }
        }
    );
}

export async function deleteChannel(channelId, success, error) {
    const {data, serverError} = await ChannelActions.deleteChannel(channelId)(dispatch, getState);

    if (data && success) {
        success(data);
    } else if (serverError && error) {
        error({id: serverError.server_error_id, ...serverError});
    }
}
