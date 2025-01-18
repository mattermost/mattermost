// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Constants from 'utils/constants';

import type {ServerError} from '@mattermost/types/errors';

import {getChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';
import {isDirectChannel, isGroupChannel, sortChannelsByTypeListAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import {loadProfilesForGroupChannels} from 'actions/user_actions';
import {getCurrentLocale} from 'selectors/i18n';
import store from 'stores/redux_store';

import type {Channel} from './command_provider/app_command_parser/app_command_parser_dependencies.js';
import Provider from './provider';
import type {ResultsCallback} from './provider';
import SearchChannelSuggestion from './search_channel_suggestion';

const getState = store.getState;
const dispatch = store.dispatch;

type SearchChannelAutocomplete = (term: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => void;

export default class SearchChannelProvider extends Provider {
    autocompleteChannelsForSearch: SearchChannelAutocomplete;

    constructor(channelSearchFunc: SearchChannelAutocomplete) {
        super();
        this.autocompleteChannelsForSearch = channelSearchFunc;
    }

    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<Channel>) {
        const captured = (/\b(?:in|channel):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (!captured) {
            return false;
        }

        const prefix = captured[1].replace(/^[@~]/, '');
        const isAtSearch = captured[1].startsWith('@');

        this.startNewRequest(prefix);

        this.autocompleteChannelsForSearch(
            prefix,
            async (channels: Channel[]) => {
                if (this.shouldCancelDispatch(prefix)) {
                    return;
                }

                let filteredChannels = channels;
                if (isAtSearch) {
                    filteredChannels = channels.filter((ch: Channel) =>
                        isDirectChannel(ch) || isGroupChannel(ch),
                    );
                }

                // Load profiles for group channels if needed
                const groupChannels = filteredChannels.filter(isGroupChannel);
                if (groupChannels.length > 0) {
                    await dispatch(loadProfilesForGroupChannels(groupChannels));
                }

                // Sort channels
                const locale = getCurrentLocale(getState());
                filteredChannels.sort(sortChannelsByTypeListAndDisplayName.bind(null, locale, [
                    Constants.OPEN_CHANNEL,
                    Constants.PRIVATE_CHANNEL,
                    Constants.DM_CHANNEL,
                    Constants.GM_CHANNEL,
                ]));

                // Get channel names using the selector
                const channelNames = filteredChannels.map((channel) => {
                    const name = getChannelNameForSearchShortcut(getState(), channel.id) || channel.name;
                    return isAtSearch && name[0] !== '@' ? `@${name}` : name;
                });

                resultsCallback({
                    matchedPretext: prefix,
                    terms: channelNames,
                    items: filteredChannels,
                    component: SearchChannelSuggestion,
                });
            },
        );

        return true;
    }
}
