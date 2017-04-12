// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';
import Provider from './provider.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {autocompleteUsers} from 'actions/user_actions.jsx';
import Client from 'client/web_client.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import {sortChannelsByDisplayName, buildGroupChannelName} from 'utils/channel_utils.jsx';

import React from 'react';

class SwitchChannelSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        let displayName = item.display_name;
        let icon = null;
        if (item.type === Constants.OPEN_CHANNEL) {
            icon = <div className='status'><i className='fa fa-globe'/></div>;
        } else if (item.type === Constants.PRIVATE_CHANNEL) {
            icon = <div className='status'><i className='fa fa-lock'/></div>;
        } else if (item.type === Constants.GM_CHANNEL) {
            displayName = buildGroupChannelName(item.id);
            icon = <div className='status status--group'>{UserStore.getProfileListInChannel(item.id, true).length}</div>;
        } else {
            icon = (
                <div className='pull-left'>
                    <img
                        className='mention__image'
                        src={Client.getUsersRoute() + '/' + item.id + '/image?time=' + item.last_picture_update}
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

export default class SwitchChannelProvider extends Provider {
    handlePretextChanged(suggestionId, channelPrefix) {
        if (channelPrefix) {
            this.startNewRequest(channelPrefix);

            const allChannels = ChannelStore.getAll();
            const channels = [];

            autocompleteUsers(
                channelPrefix,
                (users) => {
                    if (this.shouldCancelDispatch(channelPrefix)) {
                        return;
                    }

                    const currentId = UserStore.getCurrentId();

                    for (const id of Object.keys(allChannels)) {
                        const channel = allChannels[id];
                        if (channel.display_name.toLowerCase().indexOf(channelPrefix.toLowerCase()) !== -1) {
                            const newChannel = Object.assign({}, channel);
                            if (newChannel.type === Constants.GM_CHANNEL) {
                                newChannel.name = buildGroupChannelName(newChannel.id);
                            }
                            channels.push(newChannel);
                        }
                    }

                    const userMap = {};
                    for (let i = 0; i < users.length; i++) {
                        const user = users[i];
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

                        const newChannel = {
                            display_name: displayName,
                            name: user.username,
                            id: user.id,
                            update_at: user.update_at,
                            type: Constants.DM_CHANNEL
                        };
                        channels.push(newChannel);
                        userMap[user.id] = user;
                    }

                    const channelNames = channels.
                        sort(sortChannelsByDisplayName).
                        map((channel) => channel.name);

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                        id: suggestionId,
                        matchedPretext: channelPrefix,
                        terms: channelNames,
                        items: channels,
                        component: SwitchChannelSuggestion
                    });

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_PROFILES,
                        profiles: userMap
                    });
                }
            );
        }
    }
}
