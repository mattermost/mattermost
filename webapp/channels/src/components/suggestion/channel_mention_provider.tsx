// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {getMyChannels, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import type {ActionResult} from 'mattermost-redux/types/actions.js';
import {sortChannelsByTypeAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import store from 'stores/redux_store';

import usePrefixedIds from 'components/common/hooks/usePrefixedIds';

import {getArchiveIconClassName} from 'utils/channel_utils';
import {Constants} from 'utils/constants';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';

export const MIN_CHANNEL_LINK_LENGTH = 2;

export const ChannelMentionSuggestion = React.forwardRef<HTMLLIElement, SuggestionProps<Channel>>((props, ref) => {
    const {formatMessage} = useIntl();

    const {id, item: channel} = props;
    const channelName = channel.display_name;
    const channelIsArchived = channel && channel.delete_at && channel.delete_at !== 0;

    const ids = usePrefixedIds(id, {
        channelType: null,
        name: null,
    });

    let channelIcon;
    if (channelIsArchived) {
        channelIcon = (
            <span
                id={ids.channelType}
                className='suggestion-list__icon suggestion-list__icon--large'
                aria-label={formatMessage({
                    id: 'suggestion.archived_channel',
                    defaultMessage: 'Archived channel',
                })}
            >
                <i
                    className={`icon ${getArchiveIconClassName(channel?.type)}`}
                    role='presentation'
                />
            </span>
        );
    } else {
        let iconClass;
        let iconLabel;
        if (channel?.type === Constants.OPEN_CHANNEL) {
            iconClass = 'icon-globe';
            iconLabel = formatMessage({
                id: 'suggestion.public_channel',
                defaultMessage: 'Public channel',
            });
        } else {
            iconClass = 'icon-lock-outline';
            iconLabel = formatMessage({
                id: 'suggestion.private_channel',
                defaultMessage: 'Private channel',
            });
        }

        channelIcon = (
            <span
                id={ids.channelType}
                className='suggestion-list__icon suggestion-list__icon--large'
                aria-label={iconLabel}
            >
                <i className={`icon icon--no-spacing ${iconClass}`}/>
            </span>
        );
    }

    const description = '~' + channel?.name;

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
            aria-labelledby={ids.name}
            aria-describedby={ids.channelType}
        >
            {channelIcon}
            <div className='suggestion-list__ellipsis'>
                <span
                    id={ids.name}
                    className='suggestion-list__main'
                >
                    {channelName}
                </span>
                {description}
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

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<Channel>) {
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
        const myChannelIds: Record<string, boolean> = {};
        let myChannels: Channel[] = [];
        getMyChannels(store.getState()).forEach((item) => {
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
            myChannelIds[item.id] = true;
            myChannels.push(item);
        });
        myChannels = myChannels.sort((a, b) => {
            //
            // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
            //
            return sortChannelsByTypeAndDisplayName('en', a, b);
        });
        resultCallback({
            groups: [
                myChannelsGroup(myChannels),
                moreChannelsGroup([], true),
            ],
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

            const moreChannels: Channel[] = [];
            channels.forEach((channel) => {
                if (channel.delete_at > 0 && !myMembers[channel.id]) {
                    return;
                }

                if (myMembers[channel.id] && !myChannelIds[channel.id]) {
                    myChannelIds[channel.id] = true;
                    myChannels.push(channel);
                    return;
                }

                if (myMembers[channel.id] && myChannelIds[channel.id]) {
                    return;
                }

                if (!myMembers[channel.id] && myChannelIds[channel.id]) {
                    delete myChannelIds[channel.id];
                    const idx = myChannels.findIndex((el) => el.id === channel.id);
                    if (idx >= 0) {
                        myChannels.splice(idx, 1);
                    }
                }

                moreChannels.push(channel);
            });

            myChannels = myChannels.sort((a, b) => {
                //
                // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
                //
                return sortChannelsByTypeAndDisplayName('en', a, b);
            });

            resultCallback({
                matchedPretext: captured[1],
                groups: [
                    myChannelsGroup(myChannels),
                    moreChannelsGroup(moreChannels, false),
                ],
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

export function myChannelsGroup(items: Channel[]) {
    const terms = items.map((channel) => '~' + channel?.name);

    return {
        key: 'myChannels',
        label: defineMessage({id: 'suggestion.mention.channels', defaultMessage: 'My Channels'}),
        terms,
        items,
        component: ChannelMentionSuggestion,
    };
}

export function moreChannelsGroup(items: Channel[], loading: boolean) {
    const label = defineMessage({id: 'suggestion.mention.morechannels', defaultMessage: 'Other Channels'});

    if (loading) {
        return {
            key: 'moreChannels',
            label,
            items: [{
                loading: true as const,
            }],
            terms: [''],
            components: [ChannelMentionSuggestion],
        };
    }

    const terms = items.map((channel) => '~' + channel?.name);

    return {
        key: 'moreChannels',
        label,
        terms,
        items,
        component: ChannelMentionSuggestion,
    };
}
