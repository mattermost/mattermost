// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isDirectChannel, isGroupChannel, sortChannelsByTypeListAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import {getCurrentLocale} from 'selectors/i18n';
import store from 'stores/redux_store.jsx';

import Constants from 'utils/constants';

import Provider from './provider';
import SearchChannelSuggestion from './search_channel_suggestion';

import type {Channel} from './command_provider/app_command_parser/app_command_parser_dependencies.js';
import type {ResultsCallback} from './provider';
import type {ServerError} from '@mattermost/types/errors';
import type {ActionFunc} from 'mattermost-redux/types/actions.js';

const getState = store.getState;

function itemToTerm(isAtSearch: boolean, item: { type: string; display_name: string; name: string }) {
    const prefix = isAtSearch ? '' : '@';
    if (item.type === Constants.DM_CHANNEL) {
        return prefix + item.display_name;
    }
    if (item.type === Constants.GM_CHANNEL) {
        return prefix + item.display_name.replace(/ /g, '');
    }
    if (item.type === Constants.OPEN_CHANNEL || item.type === Constants.PRIVATE_CHANNEL) {
        return item.name;
    }
    return item.name;
}

export default class SearchChannelProvider extends Provider {
    autocompleteChannelsForSearch: any;
    constructor(channelSearchFunc: (term: string, success: (channels: Channel[]) => void, error: (err: ServerError) => void) => ActionFunc) {
        super();
        this.autocompleteChannelsForSearch = channelSearchFunc;
    }

    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<Channel>) {
        const captured = (/\b(?:in|channel):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            let channelPrefix = captured[1];
            const isAtSearch = channelPrefix.startsWith('@');
            if (isAtSearch) {
                channelPrefix = channelPrefix.replace(/^@/, '');
            }

            this.startNewRequest(channelPrefix);

            this.autocompleteChannelsForSearch(
                channelPrefix,
                (data: Channel[]) => {
                    if (this.shouldCancelDispatch(channelPrefix)) {
                        return;
                    }

                    let channels = data;
                    if (isAtSearch) {
                        channels = channels.filter((ch: Channel) => isDirectChannel(ch) || isGroupChannel(ch));
                    }

                    const locale = getCurrentLocale(getState());

                    channels = channels.sort(sortChannelsByTypeListAndDisplayName.bind(null, locale, [Constants.OPEN_CHANNEL, Constants.PRIVATE_CHANNEL, Constants.DM_CHANNEL, Constants.GM_CHANNEL]));
                    const channelNames = channels.map(itemToTerm.bind(null, isAtSearch));

                    resultsCallback({
                        matchedPretext: channelPrefix,
                        terms: channelNames,
                        items: channels,
                        component: SearchChannelSuggestion,
                    });
                },
            );
        }

        return Boolean(captured);
    }
}
