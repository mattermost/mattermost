// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';
import Provider from './provider.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import {sortChannelsByDisplayName, getChannelDisplayName} from 'utils/channel_utils.jsx';

import React from 'react';

import store from 'stores/redux_store.jsx';
const getState = store.getState;

import {Client4} from 'mattermost-redux/client';

import {getCurrentUserId, searchProfiles} from 'mattermost-redux/selectors/entities/users';
import {getChannelsInCurrentTeam, getMyChannelMemberships, getGroupChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {Preferences} from 'mattermost-redux/constants';

class SwitchChannelSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;
        const channel = item.channel;
        const globeIcon = Constants.GLOBE_ICON_SVG;
        const lockIcon = Constants.LOCK_ICON_SVG;

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        let displayName = channel.display_name;
        let icon = null;
        if (channel.type === Constants.OPEN_CHANNEL) {
            icon = (
                <span
                    className='icon icon__globe icon--body'
                    dangerouslySetInnerHTML={{__html: globeIcon}}
                />
            );
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            icon = (
                <span
                    className='icon icon__lock icon--body'
                    dangerouslySetInnerHTML={{__html: lockIcon}}
                />
            );
        } else if (channel.type === Constants.GM_CHANNEL) {
            displayName = getChannelDisplayName(channel);
            icon = <div className='status status--group'>{'G'}</div>;
        } else {
            icon = (
                <div className='pull-left'>
                    <img
                        className='mention__image'
                        src={Utils.imageURLForUser(channel)}
                    />
                </div>
            );
        }

        return (
            <div
                onClick={this.handleClick}
                className={className}
            >
                {icon}
                {displayName}
            </div>
        );
    }
}

let prefix = '';

function quickSwitchSorter(wrappedA, wrappedB) {
    if (wrappedA.type === Constants.MENTION_CHANNELS && wrappedB.type === Constants.MENTION_MORE_CHANNELS) {
        return -1;
    } else if (wrappedB.type === Constants.MENTION_CHANNELS && wrappedA.type === Constants.MENTION_MORE_CHANNELS) {
        return 1;
    }

    const a = wrappedA.channel;
    const b = wrappedB.channel;

    let aDisplayName = getChannelDisplayName(a).toLowerCase();
    let bDisplayName = getChannelDisplayName(b).toLowerCase();

    if (a.type === Constants.DM_CHANNEL) {
        aDisplayName = aDisplayName.substring(1);
    }

    if (b.type === Constants.DM_CHANNEL) {
        bDisplayName = bDisplayName.substring(1);
    }

    const aStartsWith = aDisplayName.startsWith(prefix);
    const bStartsWith = bDisplayName.startsWith(prefix);
    if (aStartsWith && bStartsWith) {
        return sortChannelsByDisplayName(a, b);
    } else if (!aStartsWith && !bStartsWith) {
        return sortChannelsByDisplayName(a, b);
    } else if (aStartsWith) {
        return -1;
    }

    return 1;
}

export default class SwitchChannelProvider extends Provider {
    handlePretextChanged(suggestionId, channelPrefix) {
        if (channelPrefix) {
            prefix = channelPrefix;
            this.startNewRequest(suggestionId, channelPrefix);

            // Dispatch suggestions for local data
            const channels = getChannelsInCurrentTeam(getState()).concat(getGroupChannels(getState()));
            const users = Object.assign([], searchProfiles(getState(), channelPrefix, true));
            this.formatChannelsAndDispatch(channelPrefix, suggestionId, channels, users, true);

            // Fetch data from the server and dispatch
            this.fetchUsersAndChannels(channelPrefix, suggestionId);

            return true;
        }

        return false;
    }

    async fetchUsersAndChannels(channelPrefix, suggestionId) {
        let teamId = '';
        if (global.window.mm_config.RestrictDirectMessage === 'team') {
            teamId = store.getState().entities.teams.currentTeamId;
        }
        const usersAsync = Client4.autocompleteUsers(channelPrefix, teamId, '');
        const channelsAsync = Client4.searchChannels(getCurrentTeamId(getState()), channelPrefix);

        let usersFromServer = [];
        let channelsFromServer = [];
        try {
            usersFromServer = await usersAsync;
            channelsFromServer = await channelsAsync;
        } catch (err) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ERROR,
                err
            });
        }

        if (this.shouldCancelDispatch(channelPrefix)) {
            return;
        }

        const users = Object.assign([], searchProfiles(getState(), channelPrefix, true), usersFromServer.users);
        const channels = getChannelsInCurrentTeam(getState()).concat(getGroupChannels(getState())).concat(channelsFromServer);
        this.formatChannelsAndDispatch(channelPrefix, suggestionId, channels, users);
    }

    formatChannelsAndDispatch(channelPrefix, suggestionId, allChannels, users, skipNotInChannel = false) {
        const channels = [];
        const members = getMyChannelMemberships(getState());

        if (this.shouldCancelDispatch(channelPrefix)) {
            return;
        }

        const currentId = getCurrentUserId(getState());

        const completedChannels = {};

        for (const id of Object.keys(allChannels)) {
            const channel = allChannels[id];

            if (completedChannels[channel.id]) {
                continue;
            }

            const member = members[channel.id];

            if (channel.display_name.toLowerCase().indexOf(channelPrefix.toLowerCase()) !== -1) {
                const newChannel = Object.assign({}, channel);
                const wrappedChannel = {channel: newChannel, name: newChannel.name};
                if (newChannel.type === Constants.GM_CHANNEL) {
                    newChannel.name = getChannelDisplayName(newChannel);
                    wrappedChannel.name = newChannel.name;
                    const isGMVisible = getBool(getState(), Preferences.CATEGORY_GROUP_CHANNEL_SHOW, newChannel.id, false);
                    if (isGMVisible) {
                        wrappedChannel.type = Constants.MENTION_CHANNELS;
                    } else {
                        wrappedChannel.type = Constants.MENTION_MORE_CHANNELS;
                        if (skipNotInChannel) {
                            continue;
                        }
                    }
                } else if (member) {
                    wrappedChannel.type = Constants.MENTION_CHANNELS;
                } else {
                    wrappedChannel.type = Constants.MENTION_MORE_CHANNELS;
                    if (skipNotInChannel || !newChannel.display_name.toLowerCase().startsWith(channelPrefix)) {
                        continue;
                    }
                }

                completedChannels[channel.id] = true;
                channels.push(wrappedChannel);
            }
        }

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            if (completedChannels[user.id]) {
                continue;
            }

            const isDMVisible = getBool(getState(), Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, user.id, false);
            let displayName = `@${user.username} `;

            if (user.id === currentId) {
                continue;
            }

            if ((user.first_name || user.last_name) && user.nickname) {
                displayName += `- ${Utils.getFullName(user)} (${user.nickname})`;
            } else if (user.nickname) {
                displayName += `- (${user.nickname})`;
            } else if (user.first_name || user.last_name) {
                displayName += `- ${Utils.getFullName(user)}`;
            }

            const wrappedChannel = {
                channel: {
                    display_name: displayName,
                    name: user.username,
                    id: user.id,
                    update_at: user.update_at,
                    type: Constants.DM_CHANNEL,
                    last_picture_update: user.last_picture_update || 0
                },
                name: user.username
            };

            if (isDMVisible) {
                wrappedChannel.type = Constants.MENTION_CHANNELS;
            } else {
                wrappedChannel.type = Constants.MENTION_MORE_CHANNELS;
                if (skipNotInChannel) {
                    continue;
                }
            }

            completedChannels[user.id] = true;
            channels.push(wrappedChannel);
        }

        const channelNames = channels.
            sort(quickSwitchSorter).
            map((wrappedChannel) => wrappedChannel.channel.name);

        if (skipNotInChannel) {
            channels.push({
                type: Constants.MENTION_MORE_CHANNELS,
                loading: true
            });
        }

        setTimeout(() => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                id: suggestionId,
                matchedPretext: channelPrefix,
                terms: channelNames,
                items: channels,
                component: SwitchChannelSuggestion
            });
        }, 0);
    }
}
