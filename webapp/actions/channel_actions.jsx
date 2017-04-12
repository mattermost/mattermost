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
    AsyncClient.viewChannel();
    ChannelStore.resetCounts(channelId);
    ChannelStore.emitChange();
    if (channelId === ChannelStore.getCurrentId()) {
        ChannelStore.emitLastViewed(Number.MAX_VALUE, false);
    }
}

export function addUserToChannel(channelId, userId, success, error) {
    Client.addChannelMember(
        channelId,
        userId,
        (data) => {
            UserStore.removeProfileNotInChannel(channelId, userId);
            const profile = UserStore.getProfile(userId);
            if (profile) {
                UserStore.saveProfileInChannel(channelId, profile);
                UserStore.emitInChannelChange();
            }
            UserStore.emitNotInChannelChange();

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'addChannelMember');

            if (error) {
                error(err);
            }
        }
    );
}

export function removeUserFromChannel(channelId, userId, success, error) {
    Client.removeChannelMember(
        channelId,
        userId,
        (data) => {
            UserStore.removeProfileInChannel(channelId, userId);
            const profile = UserStore.getProfile(userId);
            if (profile) {
                UserStore.saveProfileNotInChannel(channelId, profile);
                UserStore.emitNotInChannelChange();
            }
            UserStore.emitInChannelChange();

            ChannelStore.removeMemberInChannel(channelId, userId);
            ChannelStore.emitChange();

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'removeChannelMember');

            if (error) {
                error(err);
            }
        }
    );
}

export function makeUserChannelAdmin(channelId, userId, success, error) {
    Client.updateChannelMemberRoles(
        channelId,
        userId,
        'channel_user channel_admin',
        () => {
            getChannelMembersForUserIds(channelId, [userId]);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function makeUserChannelMember(channelId, userId, success, error) {
    Client.updateChannelMemberRoles(
        channelId,
        userId,
        'channel_user',
        () => {
            getChannelMembersForUserIds(channelId, [userId]);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
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

    Client.createDirectChannel(
        userId,
        (data) => {
            Client.getChannel(
                data.id,
                (data2) => {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_CHANNEL,
                        channel: data2.channel,
                        member: data2.member
                    });

                    PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
                    loadProfilesForSidebar();

                    AsyncClient.savePreference(
                        Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
                        userId,
                        'true'
                    );

                    if (success) {
                        success(data2.channel, false);
                    }
                }
            );
        },
        () => {
            browserHistory.push(TeamStore.getCurrentTeamUrl() + '/channels/' + channelName);
            if (error) {
                error();
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
    AsyncClient.getChannels().then(() => {
        AsyncClient.getMyChannelMembers().then(() => {
            loadDMsAndGMsForUnreads();
        });
    });
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
                loadNewDMIfNeeded(Utils.getUserIdFromChannelName(channel));
            } else if (channel && channel.type === Constants.GM_CHANNEL) {
                loadNewGMIfNeeded(channel.id);
            }
        }
    }
}

export function joinChannel(channel, success, error) {
    Client.joinChannel(
        channel.id,
        () => {
            ChannelStore.removeMoreChannel(channel.id);
            ChannelStore.storeChannel(channel);

            if (success) {
                success();
            }
        },
        () => {
            if (error) {
                error();
            }
        }
    );
}

export function updateChannel(channel, success, error) {
    Client.updateChannel(
        channel,
        () => {
            AsyncClient.getChannel(channel.id);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function searchMoreChannels(term, success, error) {
    Client.searchMoreChannels(
        term,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function autocompleteChannels(term, success, error) {
    Client.autocompleteChannels(
        term,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'autocompleteChannels');

            if (error) {
                error(err);
            }
        }
    );
}

export function updateChannelNotifyProps(data, options, success, error) {
    Client.updateChannelNotifyProps(Object.assign({}, data, options),
        () => {
            const member = ChannelStore.getMyMember(data.channel_id);
            member.notify_props = Object.assign(member.notify_props, options);
            ChannelStore.storeMyChannelMember(member);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function createChannel(channel, success, error) {
    Client.createChannel(
        channel,
        (data) => {
            const existing = ChannelStore.getChannelById(data.id);
            if (existing) {
                if (success) {
                    success({channel: existing});
                }
            } else {
                Client.getChannel(
                    data.id,
                    (data2) => {
                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECEIVED_CHANNEL,
                            channel: data2.channel,
                            member: data2.channel
                        });

                        if (success) {
                            success(data2);
                        }
                    },
                    (err) => {
                        AsyncClient.dispatchError(err, 'getChannel');

                        if (error) {
                            error(err);
                        }
                    }
                );
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'createChannel');

            if (error) {
                error(err);
            }
        }
    );
}

export function updateChannelPurpose(channelId, purposeValue, success, error) {
    Client.updateChannelPurpose(
        channelId,
        purposeValue,
        () => {
            AsyncClient.getChannel(channelId);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function updateChannelHeader(channelId, header, success, error) {
    Client.updateChannelHeader(
        channelId,
        header,
        (channelData) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNEL,
                channel: channelData
            });

            if (success) {
                success(channelData);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function getChannelMembersForUserIds(channelId, userIds, success, error) {
    Client.getChannelMembersByIds(
        channelId,
        userIds,
        (data) => {
            const memberMap = {};
            for (let i = 0; i < data.length; i++) {
                memberMap[data[i].user_id] = data[i];
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MEMBERS_IN_CHANNEL,
                channel_id: channelId,
                channel_members: memberMap
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getChannelMembersByIds');

            if (error) {
                error(err);
            }
        }
    );
}

export function leaveChannel(channelId, success, error) {
    Client.leaveChannel(channelId,
        () => {
            loadChannelsForCurrentUser();

            if (ChannelUtils.isFavoriteChannelId(channelId)) {
                unmarkFavorite(channelId);
            }

            const townsquare = ChannelStore.getByName('town-square');
            browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + townsquare.name);

            if (success) {
                success();
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'handleLeave');

            if (error) {
                error(err);
            }
        }
    );
}

export function deleteChannel(channelId, success, error) {
    Client.deleteChannel(
            channelId,
            () => {
                loadChannelsForCurrentUser();

                if (success) {
                    success();
                }
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleDelete');

                if (error) {
                    error(err);
                }
            }
        );
}
