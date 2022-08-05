// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Channel} from '@mattermost/types/channels';
import {ActionResult} from 'mattermost-redux/types/actions.js';

import {
    getMyChannelMemberships,
    getChannelsInAllTeams,
} from 'mattermost-redux/selectors/entities/channels';

import {sortChannelsByTypeAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import store from 'stores/redux_store.jsx';

import {Constants} from 'utils/constants';

import Provider, {ResultsCallback} from './provider';
import {SuggestionContainer, SuggestionProps} from './suggestion';
import {getCurrentTeamId, getMyTeams, getTeam} from 'mattermost-redux/selectors/entities/teams';

export const MIN_CHANNEL_LINK_LENGTH = 2;

type WrappedChannel = {
    type: string;
    channel?: Channel;
    loading?: boolean;
}

export const ChannelMentionSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<WrappedChannel>>((props, ref) => {
    const {item} = props;
    const channelIsArchived = item.channel && item.channel.delete_at && item.channel.delete_at !== 0;

    const channelName = item.channel?.display_name;
    let channelIcon;
    if (channelIsArchived) {
        channelIcon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-archive-outline'/>
            </span>
        );
    } else {
        channelIcon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className={`icon icon--no-spacing icon-${item.channel?.type === Constants.OPEN_CHANNEL ? 'globe' : 'lock-outline'}`}/>
            </span>
        );
    }

    let teamName = null;
    if (item.channel && item.channel.team_id) {
        const team = getTeam(store.getState(), item.channel.team_id);

        if(team){
            teamName = (<span className='ml-2 suggestion-list__team-name'>{team.display_name}</span>);
        }
    }

    const description = '~' + item.channel?.name;
    const isPartOfOnlyOneTeam = getMyTeams(store.getState()).length === 1;
    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {channelIcon}
            <div className='suggestion-list__ellipsis'>
                <span className='suggestion-list__main'>
                    {channelName}
                </span>
                <span className='ml-2'>
                        {description}
                    {!isPartOfOnlyOneTeam && <span>{teamName}</span>}
                </span>
            </div>
        </SuggestionContainer>
    );
});
ChannelMentionSuggestion.displayName = 'ChannelMentionSuggestion';

export default class ChannelMentionProvider extends Provider {
    private lastPrefixTrimmed: string;
    private lastPrefixWithNoResults: string;
    private lastCompletedWord: string;
    triggerCharacter: string;
    private delayChannelAutocomplete: boolean;
    autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error: () => void) => Promise<ActionResult>;

    constructor(channelSearchFunc: (term: string, success: (channels: Channel[]) => void, error: () => void) => Promise<ActionResult>, delayChannelAutocomplete: boolean) {
        super();

        this.lastPrefixTrimmed = '';
        this.lastPrefixWithNoResults = '';
        this.lastCompletedWord = '';
        this.triggerCharacter = '~';

        this.autocompleteChannels = channelSearchFunc;
        this.delayChannelAutocomplete = delayChannelAutocomplete;
    }

    setProps(props: {delayChannelAutocomplete: boolean}) {
        this.delayChannelAutocomplete = props.delayChannelAutocomplete;
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<WrappedChannel>) {
        const currentTeamId = getCurrentTeamId(store.getState());
        this.resetRequest();

        const captured = (/\B(~([^~\r\n]*))$/i).exec(pretext.toLowerCase());

        if (!captured) {
            // Not a channel mention
            return false;
        }

        if (captured.index > 0 && pretext[captured.index - 1] === '~') {
            // Multiple ~'s in a row so let's return and not show the autocomplete
            return false;
        }

        const prefix = captured[2];

        if (this.delayChannelAutocomplete && prefix.length < MIN_CHANNEL_LINK_LENGTH) {
            return false;
        }

        if (this.lastPrefixTrimmed && prefix.trim() === this.lastPrefixTrimmed) {
            // Don't keep searching if the user keeps typing spaces
            return true;
        }

        this.lastPrefixTrimmed = prefix.trim();

        if (this.lastPrefixWithNoResults && prefix.startsWith(this.lastPrefixWithNoResults)) {
            // Just give up since we know it won't return any results
            return false;
        }

        if (this.lastCompletedWord && captured[0].startsWith(this.lastCompletedWord)) {
            // It appears we're still matching a channel handle that we already completed
            return false;
        }

        // Clear the last completed word since we've started to match new text
        this.lastCompletedWord = '';

        this.startNewRequest(prefix);

        const words = prefix.toLowerCase().split(/\s+/);
        const wrappedChannelIds: Record<string, boolean> = {};
        let wrappedChannels: WrappedChannel[] = [];
        getChannelsInAllTeams(store.getState()).forEach((item) => {
            if (item.type !== 'O' || item.delete_at > 0) {
                return;
            }
            const nameWords = item.name.toLowerCase().split(/\s+/).concat(item.display_name.toLowerCase().split(/\s+/));
            let matched = true;
            for (let j = 0; matched && j < words.length; j++) {
                if (!words[j]) {
                    continue;
                }
                let wordMatched = false;
                for (let i = 0; i < nameWords.length; i++) {
                    if (nameWords[i].startsWith(words[j])) {
                        wordMatched = true;
                        break;
                    }
                }
                if (!wordMatched) {
                    matched = false;
                    break;
                }
            }
            if (!matched) {
                return;
            }
            wrappedChannelIds[item.id] = true;
            wrappedChannels.push({
                type: Constants.MENTION_CHANNELS,
                channel: item,
            });
        });
        wrappedChannels = wrappedChannels.sort((a, b) => {
            //
            // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
            //
            return sortChannelsByTypeAndDisplayName('en', a.channel as Channel, b.channel as Channel);
        });
        const channelMentions = wrappedChannels.map((item) => {
            if (item.type !== Constants.GM_CHANNEL && item.type !== Constants.DM_CHANNEL && item.channel?.team_id) {
                const team = getTeam(store.getState(), item.channel.team_id);
                if (currentTeamId !== item.channel.team_id) {
                    return '~' + item.channel?.name + `(${team.name})`;
                }
            }
            return '~' + item.channel?.name;
        });
        resultCallback({
            terms: channelMentions.concat([' ']),
            items: wrappedChannels.concat([{
                type: Constants.MENTION_CHANNELS,
                loading: true,
            }]),
            component: ChannelMentionSuggestion,
            matchedPretext: captured[1],
        });

        const handleChannels = (channels: Channel[], withError: boolean) => {
            if (prefix !== this.latestPrefix || this.shouldCancelDispatch(prefix)) {
                return;
            }

            const myMembers = getMyChannelMemberships(store.getState());

            if (channels.length === 0 && !withError) {
                this.lastPrefixWithNoResults = prefix;
            }

            // Wrap channels in an outer object to avoid overwriting the 'type' property.
            const wrappedMoreChannels: WrappedChannel[] = [];
            channels.forEach((item) => {
                if (item.delete_at > 0 && !myMembers[item.id]) {
                    return;
                }

                if (myMembers[item.id] && !wrappedChannelIds[item.id]) {
                    wrappedChannelIds[item.id] = true;
                    wrappedChannels.push({
                        type: Constants.MENTION_CHANNELS,
                        channel: item,
                    });
                    return;
                }

                if (myMembers[item.id] && wrappedChannelIds[item.id]) {
                    return;
                }

                if (!myMembers[item.id] && wrappedChannelIds[item.id]) {
                    delete wrappedChannelIds[item.id];
                    const idx = wrappedChannels.map((el) => el.channel?.id).indexOf(item.id);
                    if (idx >= 0) {
                        wrappedChannels.splice(idx, 1);
                    }
                }

                wrappedMoreChannels.push({
                    type: Constants.MENTION_CHANNELS,
                    channel: item,
                });
            });

            wrappedChannels = wrappedChannels.sort((a, b) => {
                //
                // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
                //
                return sortChannelsByTypeAndDisplayName('en', a.channel as Channel, b.channel as Channel);
            });

            const wrapped = wrappedChannels.concat(wrappedMoreChannels);
            const mentions = wrapped.map((item) => {
                if (item.type !== Constants.GM_CHANNEL && item.type !== Constants.DM_CHANNEL && item.channel?.team_id) {
                    const team = getTeam(store.getState(), item.channel.team_id);
                    if (currentTeamId !== item.channel.team_id) {
                        return '~' + item.channel?.name + `(${team.name})`;
                    }
                }
                return '~' + item.channel?.name;
            });

            resultCallback({
                matchedPretext: captured[1],
                terms: mentions,
                items: wrapped,
                component: ChannelMentionSuggestion,
            });
        };

        this.autocompleteChannels(
            prefix,
            (channels: Channel[]) => handleChannels(channels, false),
            () => handleChannels([], true),
        );

        return true;
    }

    handleCompleteWord(term: string) {
        this.lastCompletedWord = term;
        this.lastPrefixWithNoResults = '';
    }
}
