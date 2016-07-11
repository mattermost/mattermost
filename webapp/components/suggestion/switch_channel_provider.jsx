// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';
import Suggestion from './suggestion.jsx';
import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

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

        return (
            <div
                onClick={this.handleClick}
                className={className}
            >
            {displayName}
            </div>
        );
    }
}

export default class SwitchChannelProvider {
    handlePretextChanged(suggestionId, channelPrefix) {
        if (channelPrefix) {
            const allChannels = ChannelStore.getAll();
            const channels = [];

            for (const id of Object.keys(allChannels)) {
                const channel = allChannels[id];
                if (channel.display_name.toLowerCase().startsWith(channelPrefix.toLowerCase())) {
                    channels.push(channel);
                } else if (channel.type === Constants.DM_CHANNEL && Utils.getDirectTeammate(channel.id).username.startsWith(channelPrefix.toLowerCase())) {
                    // New channel to not modify existing channel
                    const newChannel = {
                        display_name: Utils.getDirectTeammate(channel.id).username,
                        name: Utils.getDirectTeammate(channel.id).username + ' ' + Utils.localizeMessage('channel_switch_modal.dm', '(Direct Message)'),
                        type: Constants.DM_CHANNEL
                    };
                    channels.push(newChannel);
                }
            }

            channels.sort((a, b) => {
                if (a.display_name === b.display_name) {
                    return a.name.localeCompare(b.name);
                }
                return a.display_name.localeCompare(b.display_name);
            });

            const channelNames = channels.map((channel) => channel.name);

            SuggestionStore.addSuggestions(suggestionId, channelNames, channels, SwitchChannelSuggestion, channelPrefix);
        }
    }
}
