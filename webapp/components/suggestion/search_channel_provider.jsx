// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';

import {autocompleteChannels} from 'actions/channel_actions.jsx';

import ChannelStore from 'stores/channel_store.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';

import React from 'react';

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
                <i className='fa fa fa-plus-square'/>{item.name}
            </div>
        );
    }
}

export default class SearchChannelProvider {
    constructor() {
        this.timeoutId = '';
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    handlePretextChanged(suggestionId, pretext) {
        const captured = (/\b(?:in|channel):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const channelPrefix = captured[1];

            function autocomplete() {
                autocompleteChannels(
                    channelPrefix,
                    (data) => {
                        const publicChannels = data;

                        const localChannels = ChannelStore.getAll();
                        const privateChannels = [];

                        for (const id of Object.keys(localChannels)) {
                            const channel = localChannels[id];
                            if (channel.name.startsWith(channelPrefix) && channel.type === Constants.PRIVATE_CHANNEL) {
                                privateChannels.push(channel);
                            }
                        }

                        const filteredPublicChannels = [];
                        publicChannels.forEach((item) => {
                            if (item.name.startsWith(channelPrefix)) {
                                filteredPublicChannels.push(item);
                            }
                        });

                        privateChannels.sort((a, b) => a.name.localeCompare(b.name));
                        filteredPublicChannels.sort((a, b) => a.name.localeCompare(b.name));

                        const channels = filteredPublicChannels.concat(privateChannels);
                        const channelNames = channels.map((channel) => channel.name);

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                            id: suggestionId,
                            matchedPretext: channelPrefix,
                            terms: channelNames,
                            items: channels,
                            component: SearchChannelSuggestion
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
