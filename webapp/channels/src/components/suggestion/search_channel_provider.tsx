// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';

import {isDirectChannel, isGroupChannel, sortChannelsByTypeListAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import {loadProfilesForGroupChannels} from 'actions/user_actions';
import {getCurrentLocale} from 'selectors/i18n';
import {getChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';
import store from 'stores/redux_store';

import Constants from 'utils/constants';

import type {Channel} from './command_provider/app_command_parser/app_command_parser_dependencies.js';
import Provider from './provider';
import type {ResultsCallback} from './provider';
import SearchChannelSuggestion from './search_channel_suggestion';

const getState = store.getState;
const dispatch = store.dispatch;

function itemToTerm(isAtSearch: boolean, item: { id: string; type: string; display_name: string; name: string }) {
    const prefix = isAtSearch ? '' : '@';
    const name = getChannelNameForSearchShortcut(getState(), item.id);
    return name ? prefix + name : item.name;
}

type SearchChannelAutocomplete = (term: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => void;

export default class SearchChannelProvider extends Provider {
    autocompleteChannelsForSearch: SearchChannelAutocomplete;

    constructor(channelSearchFunc: SearchChannelAutocomplete) {
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
            const isTildeSearch = channelPrefix.startsWith('~');
            if (isTildeSearch) {
                channelPrefix = channelPrefix.replace(/^~/, '');
            }
            this.startNewRequest(channelPrefix);

            this.autocompleteChannelsForSearch(
                channelPrefix,
                async (data: Channel[]) => {
                    if (this.shouldCancelDispatch(channelPrefix)) {
                        return;
                    }

                    let channels = data;
                    if (isAtSearch) {
                        channels = channels.filter((ch: Channel) => isDirectChannel(ch) || isGroupChannel(ch));
                    }
                    const gms = channels.filter((ch: Channel) => isGroupChannel(ch));
                    if (gms.length > 0) {
                        await dispatch(loadProfilesForGroupChannels(gms));
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
