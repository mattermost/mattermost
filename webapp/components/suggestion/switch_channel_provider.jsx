// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {autocompleteUsersInTeam} from 'actions/user_actions.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

class SwitchChannelSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        let displayName = '';
        if (item.type === Constants.DM_CHANNEL) {
            displayName = item.display_name + ' ' + Utils.localizeMessage('channel_switch_modal.dm', '(Direct Message)');
        } else {
            displayName = item.display_name + ' (' + item.name + ')';
        }

        let icon = null;
        if (item.type === Constants.OPEN_CHANNEL) {
            icon = <div className='status'><i className='fa fa-globe'/></div>;
        } else if (item.type === Constants.PRIVATE_CHANNEL) {
            icon = <div className='status'><i className='fa fa-lock'/></div>;
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

export default class SwitchChannelProvider {
    constructor() {
        this.timeoutId = '';
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    handlePretextChanged(suggestionId, channelPrefix) {
        if (channelPrefix) {
            const allChannels = ChannelStore.getAll();
            const channels = [];

            function autocomplete() {
                autocompleteUsersInTeam(
                    channelPrefix,
                    (data) => {
                        const users = data.in_team;
                        const currentId = UserStore.getCurrentId();

                        for (const id of Object.keys(allChannels)) {
                            const channel = allChannels[id];
                            if (channel.display_name.toLowerCase().startsWith(channelPrefix.toLowerCase())) {
                                channels.push(channel);
                            }
                        }

                        const userMap = {};
                        for (let i = 0; i < users.length; i++) {
                            const user = users[i];

                            if (user.id === currentId) {
                                continue;
                            }

                            const newChannel = {
                                display_name: user.username,
                                name: user.username + ' ' + Utils.localizeMessage('channel_switch_modal.dm', '(Direct Message)'),
                                type: Constants.DM_CHANNEL
                            };
                            channels.push(newChannel);
                            userMap[user.id] = user;
                        }

                        channels.sort((a, b) => {
                            if (a.display_name === b.display_name) {
                                if (a.type !== Constants.DM_CHANNEL && b.type === Constants.DM_CHANNEL) {
                                    return -1;
                                } else if (a.type === Constants.DM_CHANNEL && b.type !== Constants.DM_CHANNEL) {
                                    return 1;
                                }
                                return a.name.localeCompare(b.name);
                            }
                            return a.display_name.localeCompare(b.display_name);
                        });

                        const channelNames = channels.map((channel) => channel.name);

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

            this.timeoutId = setTimeout(
                autocomplete.bind(this),
                Constants.AUTOCOMPLETE_TIMEOUT
            );
        }
    }
}
