// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';
import Suggestion from './suggestion.jsx';

class SwitchChannelSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        const displayName = item.display_name + ' (' + item.name + ')';

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
                }
            }

            channels.sort((a, b) => a.display_name.localeCompare(b.display_name));
            const channelNames = channels.map((channel) => channel.name);

            SuggestionStore.addSuggestions(suggestionId, channelNames, channels, SwitchChannelSuggestion, channelPrefix);
        }
    }
}
