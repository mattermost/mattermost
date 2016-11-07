// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import SuggestionStore from 'stores/suggestion_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import Constants from 'utils/constants.jsx';

import Suggestion from './suggestion.jsx';

const MaxChannelSuggestions = 40;

class ChannelMentionSuggestion extends Suggestion {
    render() {
        const isSelection = this.props.isSelection;
        const item = this.props.item;

        const channelName = item.channel.display_name;
        const purpose = item.channel.purpose;

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        const description = '(~' + item.channel.name + ')';

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <div className='mention__align'>
                    <span>
                        {channelName}
                    </span>
                    <span className='mention__channelname'>
                        {' '}
                        {description}
                    </span>
                </div>
                <div className='mention__purpose'>
                    {purpose}
                </div>
            </div>
        );
    }
}

function filterChannelsByPrefix(channels, prefix, limit) {
    const filtered = [];

    for (const id of Object.keys(channels)) {
        if (filtered.length >= limit) {
            break;
        }

        const channel = channels[id];

        if (channel.delete_at > 0) {
            continue;
        }

        if (channel.display_name.toLowerCase().startsWith(prefix) || channel.name.startsWith(prefix)) {
            filtered.push(channel);
        }
    }

    return filtered;
}

export default class ChannelMentionProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/(^|\s)(~([^~]*))$/i).exec(pretext.toLowerCase());
        if (captured) {
            const prefix = captured[3];

            const channels = ChannelStore.getAll();
            const moreChannels = ChannelStore.getMoreAll();

            // Remove private channels from the list.
            const publicChannels = channels.filter((channel) => {
                return channel.type === 'O';
            });

            // Filter channels by prefix.
            const filteredChannels = filterChannelsByPrefix(
                    publicChannels, prefix, MaxChannelSuggestions);
            const filteredMoreChannels = filterChannelsByPrefix(
                    moreChannels, prefix, MaxChannelSuggestions - filteredChannels.length);

            // Sort channels by display name.
            [filteredChannels, filteredMoreChannels].forEach((items) => {
                items.sort((a, b) => {
                    const aPrefix = a.display_name.startsWith(prefix);
                    const bPrefix = b.display_name.startsWith(prefix);

                    if (aPrefix === bPrefix) {
                        return a.display_name.localeCompare(b.display_name);
                    } else if (aPrefix) {
                        return -1;
                    }

                    return 1;
                });
            });

            // Wrap channels in an outer object to avoid overwriting the 'type' property.
            const wrappedChannels = filteredChannels.map((item) => {
                return {
                    type: Constants.MENTION_CHANNELS,
                    channel: item
                };
            });
            const wrappedMoreChannels = filteredMoreChannels.map((item) => {
                return {
                    type: Constants.MENTION_MORE_CHANNELS,
                    channel: item
                };
            });

            const wrapped = wrappedChannels.concat(wrappedMoreChannels);

            const mentions = wrapped.map((item) => '~' + item.channel.name);

            SuggestionStore.clearSuggestions(suggestionId);
            SuggestionStore.addSuggestions(suggestionId, mentions, wrapped, ChannelMentionSuggestion, captured[2]);
        }
    }
}
