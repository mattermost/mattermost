// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';

import {autocompleteChannels} from 'actions/channel_actions.jsx';

import ChannelStore from 'stores/channel_store.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';

import React from 'react';

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

export default class ChannelMentionProvider {
    constructor() {
        this.timeoutId = '';
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    handlePretextChanged(suggestionId, pretext) {
        const captured = (/(^|\s)(~([^~]*))$/i).exec(pretext.toLowerCase());
        if (captured) {
            const prefix = captured[3];

            function autocomplete() {
                autocompleteChannels(
                    prefix,
                    (data) => {
                        const channels = data;

                        // Wrap channels in an outer object to avoid overwriting the 'type' property.
                        const wrappedChannels = [];
                        const wrappedMoreChannels = [];
                        const moreChannels = [];
                        channels.forEach((item) => {
                            if (ChannelStore.get(item.id)) {
                                wrappedChannels.push({
                                    type: Constants.MENTION_CHANNELS,
                                    channel: item
                                });
                                return;
                            }

                            wrappedMoreChannels.push({
                                type: Constants.MENTION_MORE_CHANNELS,
                                channel: item
                            });

                            moreChannels.push(item);
                        });

                        const wrapped = wrappedChannels.concat(wrappedMoreChannels);
                        const mentions = wrapped.map((item) => '~' + item.channel.name);

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECEIVED_MORE_CHANNELS,
                            channels: moreChannels
                        });

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                            id: suggestionId,
                            matchedPretext: captured[2],
                            terms: mentions,
                            items: wrapped,
                            component: ChannelMentionSuggestion
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
