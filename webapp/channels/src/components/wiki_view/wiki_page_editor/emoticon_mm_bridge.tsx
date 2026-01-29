// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import {PluginKey} from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';

import {isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';

import EmoticonProvider, {
    EmoticonSuggestion,
    MIN_EMOTICON_LENGTH,
    type EmojiItem,
} from 'components/suggestion/emoticon_provider';

import {wrapProviderCallback} from './provider_bridge_utils';
import {createSuggestionRenderer} from './suggestion_renderer';

import './emoticon_suggestion_list.scss';

const emojiSuggestionPluginKey = new PluginKey('emojiSuggestion');
const provider = new EmoticonProvider();

// List component matching MM patterns
const EmoticonSuggestionList: React.FC<{
    items: EmojiItem[];
    selectedIndex: number;
    selectItem: (index: number) => void;
}> = ({items, selectedIndex, selectItem}) => (
    <ul
        className='tiptap-emoticon-suggestions'
        role='listbox'
    >
        {items.map((item, index) => (
            <EmoticonSuggestion
                key={item.name}
                item={item}
                term={`:${item.name}:`}
                isSelection={index === selectedIndex}
                onClick={() => selectItem(index)}
                onMouseMove={() => {}}
                id={`tiptap-emoticon-${item.name}-${index}`}
                matchedPretext={''}
            />
        ))}
    </ul>
);

function createEmoticonSuggestion(): Partial<SuggestionOptions<EmojiItem>> {
    return {
        char: ':',
        pluginKey: emojiSuggestionPluginKey,

        // Prevent suggestion from triggering with less than MIN_EMOTICON_LENGTH chars
        allow: ({state, range}) => {
            const query = state.doc.textBetween(range.from, range.to, '').replace(/^:/, '');
            return query.length >= MIN_EMOTICON_LENGTH;
        },

        items: ({query}): Promise<EmojiItem[]> => {
            return wrapProviderCallback<EmojiItem>(provider, `:${query}`);
        },

        ...createSuggestionRenderer<EmojiItem>({
            popupClassName: 'tiptap-emoticon-popup',
            getItemId: (item, index) => `tiptap-emoticon-${item.name}-${index}`,
            ListComponent: EmoticonSuggestionList,
            getCommandAttrs: (item) => item as unknown as Record<string, unknown>,
        }),

        command: ({editor, range, props}) => {
            if (!editor || !range || !props) {
                return;
            }

            let content: string;
            const emojiProps = props as unknown as EmojiItem;
            if (emojiProps.emoji && isSystemEmoji(emojiProps.emoji)) {
                // Parse hex code points from unified string (e.g., "1F600" or "1F1FA-1F1F8")
                const codePoints = emojiProps.emoji.unified.split('-').map((h: string) => parseInt(h, 16));

                // Validate all code points are valid numbers before using String.fromCodePoint
                // This prevents RangeError if unified string is malformed
                if (codePoints.some((cp) => isNaN(cp) || cp < 0 || cp > 0x10FFFF)) {
                    content = `:${emojiProps.name}:`;
                } else {
                    content = codePoints.map((cp) => String.fromCodePoint(cp)).join('');
                }
            } else {
                content = `:${emojiProps.name}:`;
            }

            editor.chain().focus().deleteRange(range).insertContent(content).run();
        },
    };
}

export const EmojiSuggestionExtension = Extension.create({
    name: 'emojiSuggestion',
    addProseMirrorPlugins() {
        // eslint-disable-next-line new-cap
        return [Suggestion({editor: this.editor, ...createEmoticonSuggestion()})];
    },
});
