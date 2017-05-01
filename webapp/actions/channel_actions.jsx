// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import * as ChannelUtils from 'utils/channel_utils.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import {loadProfilesForSidebar, loadNewDMIfNeeded, loadNewGMIfNeeded} from 'actions/user_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import {Constants, Preferences, ActionTypes} from 'utils/constants.jsx';

import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {
    viewChannel,
    addChannelMember,
    removeChannelMember,
    updateChannelMemberRoles,
    createDirectChannel,
    fetchMyChannelsAndMembers,
    joinChannel as joinChannelRedux,
    leaveChannel as leaveChannelRedux,
    updateChannel as updateChannelRedux,
    searchChannels,
    updateChannelNotifyProps as updateChannelNotifyPropsRedux,
    createChannel as createChannelRedux,
    patchChannel,
    getChannelMembersByIds,
    deleteChannel as deleteChannelRedux
} from 'mattermost-redux/actions/channels';

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

    msg = msg.substring(0, msg.indexOf(' ')).toLowerCase() + msg.substring(msg.indexOf(' '), msg.length);

    if (message.indexOf('/shortcuts') !== -1) {
        if (UserAgent.isMobile()) {
            const err = {message: Utils.localizeMessage('create_post.shortcutsNotSupported', 'Keyboard shortcuts are not supported on your device')};
            error(err);
            return;
        } else if (Utils.isMac()) {
            msg += ' mac';
        } else if (message.indexOf('mac') !== -1) {
            msg = '/shortcuts';
        }
    }
    Client.executeCommand(msg, args, success,
        (err) => {
            AsyncClient.dispatchError(err, 'executeCommand');

            if (error) {
                error(err);
            }
        });
}

export function setChannelAsRead(channelIdParam) {
    const channelId = channelIdParam || ChannelStore.getCurrentId();
    viewChannel(channelId)(dispatch, getState);
    ChannelStore.resetCounts([channelId]);
    ChannelStore.emitChange();
    if (channelId === ChannelStore.getCurrentId()) {
        ChannelStore.emitLastViewed(Number.MAX_VALUE, false);
    }
}

export function addUserToChannel(channelId, userId, success, error) {
    addChannelMember(channelId, userId)(dispatch, getState).then(
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
    removeChannelMember(channelId, userId)(dispatch, getState).then(
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
    updateChannelMemberRoles(channelId, userId, 'channel_user channel_admin')(dispatch, getState).then(
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
    updateChannelMemberRoles(channelId, userId, 'channel_user')(dispatch, getState).then(
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

        AsyncClient.savePreference(
            Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
            userId,
            'true'
        );

        if (success) {
            success(channel, true);
        }

        return;
    }

    createDirectChannel(UserStore.getCurrentId(), userId)(dispatch, getState).then(
        (data) => {
            loadProfilesForSidebar();
            if (data && success) {
                success(data, false);
            } else if (data == null && error) {
                browserHistory.push(TeamStore.getCurrentTeamUrl() + '/channels/' + channelName);
                const serverError = getState().requests.channels.createChannel.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function openGroupChannelToUsers(userIds, success, error) {
    Client.createGroupChannel(
        userIds,
        (data) => {
            Client.getChannelMember(
                data.id,
                UserStore.getCurrentId(),
                (data2) => {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_CHANNEL,
                        channel: data,
                        member: data2
                    });

                    PreferenceStore.setPreference(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, data.id, 'true');
                    loadProfilesForSidebar();

                    AsyncClient.savePreference(
                        Preferences.CATEGORY_GROUP_CHANNEL_SHOW,
                        data.id,
                        'true'
                    );

                    if (success) {
                        success(data);
                    }
                }
            );
        },
        () => {
            if (error) {
                error();
            }
        }
    );
}

export function markFavorite(channelId) {
    trackEvent('api', 'api_channels_favorited');
    AsyncClient.savePreference(Preferences.CATEGORY_FAVORITE_CHANNEL, channelId, 'true');
}

export function unmarkFavorite(channelId) {
    trackEvent('api', 'api_channels_unfavorited');
    const pref = {
        user_id: UserStore.getCurrentId(),
        category: Preferences.CATEGORY_FAVORITE_CHANNEL,
        name: channelId
    };

    AsyncClient.deletePreferences([pref]);
}

export function loadChannelsForCurrentUser() {
    fetchMyChannelsAndMembers(TeamStore.getCurrentId())(dispatch, getState).then(
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

export function joinChannel(channel, success, error) {
    joinChannelRedux(UserStore.getCurrentId(), null, channel.id)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.channels.joinChannel.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateChannel(channel, success, error) {
    updateChannelRedux(channel)(dispatch, getState).then(
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
    searchChannels(TeamStore.getCurrentId(), term)(dispatch, getState).then(
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

export function autocompleteChannels(term, success, error) {
    searchChannels(TeamStore.getCurrentId(), term)(dispatch, getState).then(
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
    updateChannelNotifyPropsRedux(data.user_id, data.channel_id, Object.assign({}, data, options))(dispatch, getState).then(
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
    createChannelRedux(channel)(dispatch, getState).then(
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
    patchChannel(channelId, {purpose})(dispatch, getState).then(
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
    patchChannel(channelId, {header})(dispatch, getState).then(
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
    getChannelMembersByIds(channelId, userIds)(dispatch, getState).then(
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
    leaveChannelRedux(channelId)(dispatch, getState).then(
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

export function deleteChannel(channelId, success, error) {
    deleteChannelRedux(channelId)(dispatch, getState).then(
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
