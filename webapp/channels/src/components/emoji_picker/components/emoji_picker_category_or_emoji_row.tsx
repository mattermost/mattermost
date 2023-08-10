// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {areEqual} from 'react-window';

import EmojiPickerCategorySection from 'components/emoji_picker/components/emoji_picker_category_row';
import EmojiPickerItem from 'components/emoji_picker/components/emoji_picker_item';
import {isCategoryHeaderRow} from 'components/emoji_picker/utils';

import type {CustomEmoji, Emoji, SystemEmoji} from '@mattermost/types/emojis';
import type {CategoryOrEmojiRow, EmojiCursor} from 'components/emoji_picker/types';
import type {ListChildComponentProps} from 'react-window';

interface Props extends ListChildComponentProps<CategoryOrEmojiRow[]> {
    cursorRowIndex: number;
    cursorEmojiId: SystemEmoji['unified'] | CustomEmoji['id'];
    onEmojiClick: (emoji: Emoji) => void;
    onEmojiMouseOver: (cursor: EmojiCursor) => void;
}

function EmojiPickerCategoryOrEmojiRow({index, style, data, cursorRowIndex, cursorEmojiId, onEmojiClick, onEmojiMouseOver}: Props) {
    const row = data[index];

    if (isCategoryHeaderRow(row)) {
        return (
            <EmojiPickerCategorySection
                categoryName={row.items[0].categoryName}
                style={style}
            />
        );
    }

    return (
        <div
            style={style}
            className='emoji-picker__row'
        >
            {row.items.map((emojiColumn) => {
                const emoji = emojiColumn.item;
                const isSelected = emojiColumn.emojiId.toLowerCase() === cursorEmojiId.toLowerCase() && cursorRowIndex === index;

                return (
                    <EmojiPickerItem
                        key={`${emojiColumn.categoryName}-${emojiColumn.emojiId}`}
                        emoji={emoji}
                        rowIndex={row.index}
                        isSelected={isSelected}
                        onClick={onEmojiClick}
                        onMouseOver={onEmojiMouseOver}
                    />
                );
            })}
        </div>
    );
}

export default memo(EmojiPickerCategoryOrEmojiRow, areEqual);
