// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';
import Provider from './provider.jsx';

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

export default class ChannelMentionProvider extends Provider {
    constructor() {
        super();

        this.lastTermWithNoResults = '';
        this.lastCompletedWord = '';
    }

    handlePretextChanged(suggestionId, pretext) {
        const captured = (/(^|\s)(~([^~\r\n]*))$/i).exec(pretext.toLowerCase());

        if (!captured) {
            // Not a channel mention
            return false;
        }

        if (this.lastTermWithNoResults && pretext.startsWith(this.lastTermWithNoResults)) {
            // Just give up since we know it won't return any results
            return false;
        }

        if (this.lastCompletedWord && captured[0].startsWith(this.lastCompletedWord)) {
            // It appears we're still matching a channel handle that we already completed
            return false;
        }

        // Clear the last completed word since we've started to match new text
        this.lastCompletedWord = '';

        const prefix = captured[3];

        this.startNewRequest(suggestionId, prefix);

        autocompleteChannels(
            prefix,
            (channels) => {
                if (this.shouldCancelDispatch(prefix)) {
                    return;
                }

                if (channels.length === 0) {
                    this.lastTermWithNoResults = pretext;
                }

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

        return true;
    }

    handleCompleteWord(term) {
        this.lastCompletedWord = term;
    }
}
