// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    forwardRef,
    memo,
} from 'react';
import type {
    ChangeEvent,
    KeyboardEvent} from 'react';
import {useIntl} from 'react-intl';

import {EMOJI_PER_ROW} from 'components/emoji_picker/constants';
import {NavigationDirection} from 'components/emoji_picker/types';

interface Props {
    value: string;
    cursorCategoryIndex: number;
    cursorEmojiIndex: number;
    focus: () => void;
    onEnter: () => void;
    onChange: (value: string) => void;
    onKeyDown: (moveTo: NavigationDirection) => void;
    resetCursorPosition: () => void;
}

const EmojiPickerSearch = forwardRef<HTMLInputElement, Props>(({value, cursorCategoryIndex, cursorEmojiIndex, onChange, resetCursorPosition, onKeyDown, focus, onEnter}: Props, ref) => {
    const {formatMessage} = useIntl();

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        // remove trailing and leading colons
        const value = event.target.value.toLowerCase().replace(/^:|:$/g, '');
        onChange(value);

        resetCursorPosition();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
        case 'ArrowRight':
            // If the cursor is at the end of the textbox and an emoji is currently selected, move it to the next emoji
            if ((event.currentTarget?.selectionStart ?? 0) + 1 > value.length || (cursorCategoryIndex !== -1 || cursorEmojiIndex !== -1)) {
                event.stopPropagation();
                event.preventDefault();

                onKeyDown(NavigationDirection.NextEmoji);
            }
            break;
        case 'ArrowLeft':
            if (cursorCategoryIndex > 0 || cursorEmojiIndex > 0) {
                event.stopPropagation();
                event.preventDefault();

                onKeyDown(NavigationDirection.PreviousEmoji);
            } else if (cursorCategoryIndex === 0 && cursorEmojiIndex === 0) {
                resetCursorPosition();
                event.currentTarget.selectionStart = value.length;
                event.currentTarget.selectionEnd = value.length;

                event.stopPropagation();
                event.preventDefault();

                focus();
            }
            break;
        case 'ArrowUp':
            event.stopPropagation();
            event.preventDefault();

            if (event.shiftKey) {
                // If Shift + Ctrl/Cmd + Up is pressed at any time, select/highlight the string to the left of the cursor.
                event.currentTarget.selectionStart = 0;
            } else if (cursorCategoryIndex === -1) {
                // If cursor is on the textbox, set the cursor to the beginning of the string.
                event.currentTarget.selectionStart = 0;
                event.currentTarget.selectionEnd = 0;
            } else if (cursorCategoryIndex === 0 && cursorEmojiIndex < EMOJI_PER_ROW) {
                // If the cursor is highlighting an emoji in the top row,
                // move the cursor back into the text box to the end of the string.
                resetCursorPosition();
                event.currentTarget.selectionStart = value.length;
                event.currentTarget.selectionEnd = value.length;
                focus();
            } else {
                // Otherwise, move the emoji selector up a row.
                onKeyDown(NavigationDirection.PreviousEmojiRow);
            }
            break;
        case 'ArrowDown':
            event.stopPropagation();
            event.preventDefault();

            if (event.shiftKey) {
                // If Shift + Ctrl/Cmd + Down is pressed at any time, select/highlight the string to the right of the cursor.
                event.currentTarget.selectionEnd = value.length;
            } else if (value && event.currentTarget.selectionStart === 0) {
                // If the cursor is at the beginning of the string, move the cursor to the end of the string.
                event.currentTarget.selectionStart = value.length;
                event.currentTarget.selectionEnd = value.length;
            } else {
                // Otherwise, move the selection down in the emoji picker.
                onKeyDown(NavigationDirection.NextEmojiRow);
            }
            break;
        case 'Enter': {
            event.stopPropagation();
            event.preventDefault();

            onEnter();
            break;
        }
        }
    };

    return (
        <div className='emoji-picker__text-container'>
            <span className='icon-magnify icon emoji-picker__search-icon'/>
            <input
                ref={ref}
                id='emojiPickerSearch'
                aria-label={formatMessage({id: 'emoji_picker.search_emoji', defaultMessage: 'Search for an emoji'})}
                className='emoji-picker__search'
                data-testid='emojiInputSearch'
                type='text'
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                autoComplete='off'
                placeholder={formatMessage({id: 'emoji_picker.search', defaultMessage: 'Search Emoji'})}
                value={value}
            />
        </div>
    );
},
);

EmojiPickerSearch.displayName = 'EmojiPickerSearch';

export default memo(EmojiPickerSearch);
