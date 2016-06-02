// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import Constants from 'utils/constants.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';

import Suggestion from './suggestion.jsx';

class SearchChannelSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'search-autocomplete__item';
        if (isSelection) {
            className += ' selected';
        }

        return (
            <div
                onClick={this.handleClick}
                className={className}
            >
                <i className='fa fa fa-plus-square'></i>{item.name}
            </div>
        );
    }
}

export default class SearchChannelProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/\b(?:in|channel):\s*(\S*)$/i).exec(pretext);
        if (captured) {
            const channelPrefix = captured[1];

            const channels = ChannelStore.getAll();
            const publicChannels = [];
            const privateChannels = [];

            for (const id of Object.keys(channels)) {
                const channel = channels[id];

                // don't show direct channels
                if (channel.type !== Constants.DM_CHANNEL && channel.name.startsWith(channelPrefix)) {
                    if (channel.type === Constants.OPEN_CHANNEL) {
                        publicChannels.push(channel);
                    } else {
                        privateChannels.push(channel);
                    }
                }
            }

            publicChannels.sort((a, b) => a.name.localeCompare(b.name));
            const publicChannelNames = publicChannels.map((channel) => channel.name);

            privateChannels.sort((a, b) => a.name.localeCompare(b.name));
            const privateChannelNames = privateChannels.map((channel) => channel.name);

            SuggestionStore.addSuggestions(suggestionId, publicChannelNames, publicChannels, SearchChannelSuggestion, channelPrefix);
            SuggestionStore.addSuggestions(suggestionId, privateChannelNames, privateChannels, SearchChannelSuggestion, channelPrefix);
        }
    }
}
