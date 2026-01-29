// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AtMentionProvider from 'components/suggestion/at_mention_provider';
import AtMentionSuggestion from 'components/suggestion/at_mention_provider/at_mention_suggestion';
import type {Item} from 'components/suggestion/at_mention_provider/at_mention_suggestion';

import {wrapProviderCallback} from './provider_bridge_utils';
import {createSuggestionRenderer} from './suggestion_renderer';

import './mention_suggestion_list.scss';

export type MentionBridgeProps = {
    channelId: string;
    teamId: string;
    currentUserId: string;
    autocompleteUsersInChannel: (prefix: string) => Promise<ActionResult>;
    searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined) => Promise<{data: any}>;
    autocompleteGroups: Group[] | null;
    useChannelMentions: boolean;
    priorityProfiles?: UserProfile[];
};

const MentionSuggestionList: React.FC<{
    items: Item[];
    selectedIndex: number;
    selectItem: (index: number) => void;
}> = ({items, selectedIndex, selectItem}) => (
    <ul
        className='tiptap-mention-suggestions'
        role='listbox'
    >
        {items.map((item, index) => (
            <AtMentionSuggestion
                key={item.username}
                item={item}
                isSelection={index === selectedIndex}
                onClick={() => selectItem(index)}
                onMouseMove={() => {}}
                id={`tiptap-mention-${item.username}-${index}`}
                term={''}
                matchedPretext={''}
            />
        ))}
    </ul>
);

export function createMMentionSuggestion(props: MentionBridgeProps): Partial<SuggestionOptions<Item>> {
    const provider = new AtMentionProvider({
        currentUserId: props.currentUserId,
        channelId: props.channelId,
        autocompleteUsersInChannel: (prefix: string) => props.autocompleteUsersInChannel(prefix),
        useChannelMentions: props.useChannelMentions,
        autocompleteGroups: props.autocompleteGroups,
        searchAssociatedGroupsForReference: (prefix: string) => props.searchAssociatedGroupsForReference(prefix, props.teamId, props.channelId),
        priorityProfiles: props.priorityProfiles,
    });

    return {
        items: ({query}: {query: string}): Promise<Item[]> => {
            return wrapProviderCallback<Item>(provider, `@${query}`);
        },

        ...createSuggestionRenderer<Item>({
            popupClassName: 'tiptap-mention-popup',
            getItemId: (item, index) => `tiptap-mention-${item.username}-${index}`,
            ListComponent: MentionSuggestionList,
            getCommandAttrs: (item) => ({id: item.id || item.username, label: item.username}),
            onPopupExit: () => provider.resetSuggestionState(),
        }),
    };
}
