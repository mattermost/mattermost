// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useContext} from 'react';
import {areEqual} from 'react-window';
import type {ListChildComponentProps} from 'react-window';

import EmojiPickerCategorySection from 'components/emoji_picker/components/emoji_picker_category_row';
import EmojiPickerItem from 'components/emoji_picker/components/emoji_picker_item';
import type {CategoryOrEmojiRow} from 'components/emoji_picker/types';
import {isCategoryHeaderRow} from 'components/emoji_picker/utils';

import {EmojiPickerContext} from './emoji_picker_context';

interface Props extends ListChildComponentProps<CategoryOrEmojiRow[]> {}

function EmojiPickerCategoryOrEmojiRow({index, style, data}: Props) {
    const {cursorRowIndex, cursorEmojiId, onEmojiClick, onEmojiMouseOver} = useContext(EmojiPickerContext);

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
            role='row'
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
