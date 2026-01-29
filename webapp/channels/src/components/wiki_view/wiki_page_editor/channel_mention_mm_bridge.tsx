// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/core';
import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ChannelMentionProvider, {ChannelMentionSuggestion} from 'components/suggestion/channel_mention_provider';

import {createSuggestionRenderer} from './suggestion_renderer';

import './mention_suggestion_list.scss';

export type ChannelMentionBridgeProps = {
    channelId: string;
    teamId: string;
    autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error: () => void) => Promise<ActionResult>;
    delayChannelAutocomplete?: boolean;
};

const ChannelMentionSuggestionList: React.FC<{
    items: Channel[];
    selectedIndex: number;
    selectItem: (index: number) => void;
}> = ({items, selectedIndex, selectItem}) => (
    <ul className='tiptap-mention-suggestions tiptap-channel-mention-suggestions'>
        {items.map((item, index) => (
            <ChannelMentionSuggestion
                key={item.id}
                item={item}
                isSelection={index === selectedIndex}
                onClick={() => selectItem(index)}
                onMouseMove={() => {}}
                id={`tiptap-channel-mention-${item.name}-${index}`}
                term={''}
                matchedPretext={''}
            />
        ))}
    </ul>
);

export function createChannelMentionSuggestion(props: ChannelMentionBridgeProps): Partial<SuggestionOptions<Channel>> {
    const provider = new ChannelMentionProvider(
        props.autocompleteChannels,
        props.delayChannelAutocomplete ?? false,
    );

    return {
        char: '~',

        items: async ({query}: {query: string; editor: Editor}): Promise<Channel[]> => {
            return new Promise((resolve) => {
                let callbackCount = 0;
                let pendingTimeout: NodeJS.Timeout | null = null;

                provider.handlePretextChanged(`~${query}`, (results: any) => {
                    callbackCount++;

                    if (!results || !results.groups) {
                        resolve([]);
                        return;
                    }

                    const allItems: Channel[] = results.groups.flatMap((group: any) => {
                        return (group.items || []).filter((item: any) => !item.loading);
                    });

                    const moreChannelsGroup = results.groups.find((g: any) => g.key === 'moreChannels');
                    const hasMoreChannelsWithItems = moreChannelsGroup &&
                        moreChannelsGroup.items &&
                        moreChannelsGroup.items.length > 0 &&
                        !moreChannelsGroup.items[0].loading;

                    const isFirstCallback = callbackCount === 1;

                    if (pendingTimeout) {
                        clearTimeout(pendingTimeout);
                        pendingTimeout = null;
                    }

                    if (isFirstCallback && !hasMoreChannelsWithItems && allItems.length === 0) {
                        pendingTimeout = setTimeout(() => {
                            resolve(allItems);
                        }, 150);
                        return;
                    }

                    resolve(allItems);
                });
            });
        },

        ...createSuggestionRenderer<Channel>({
            popupClassName: 'tiptap-mention-popup tiptap-channel-mention-popup',
            getItemId: (item, index) => `tiptap-channel-mention-${item.name}-${index}`,
            ListComponent: ChannelMentionSuggestionList,
            getCommandAttrs: (item) => ({
                id: item.id,
                label: item.name,
                'data-channel-id': item.id,
            }),
            onPopupExit: () => provider.resetSuggestionState(),
        }),
    };
}
