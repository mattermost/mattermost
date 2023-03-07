// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';
import throttle from 'lodash/throttle';

import {getEmojiImageUrl, isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';
import {Emoji} from '@mattermost/types/emojis';

import imgTrans from 'images/img_trans.gif';
import {EmojiCursor} from 'components/emoji_picker/types';
import {EMOJI_SCROLL_THROTTLE_DELAY} from 'components/emoji_picker/constants';

interface Props {
    emoji: Emoji;
    rowIndex: number;
    isSelected?: boolean;
    onClick: (emoji: Emoji) => void;
    onMouseOver: (cursor: EmojiCursor) => void;
}

function EmojiPickerItem({emoji, rowIndex, isSelected, onClick, onMouseOver}: Props) {
    const {formatMessage} = useIntl();

    const handleMouseOver = () => {
        if (!isSelected) {
            let emojiId = '';
            if (isSystemEmoji(emoji)) {
                emojiId = emoji.unified;
            } else {
                emojiId = emoji.id;
            }
            onMouseOver({rowIndex, emojiId, emoji});
        }
    };

    const throttledMouseOver = useCallback(
        throttle(handleMouseOver, EMOJI_SCROLL_THROTTLE_DELAY, {
            leading: true,
            trailing: false,
        }), []);

    const handleClick = () => {
        onClick(emoji);
    };

    const itemClassName = classNames('emoji-picker__item', {
        selected: isSelected,
    });

    let content;

    if (isSystemEmoji(emoji)) {
        const emojiName = emoji.short_name ? emoji.short_name : emoji.name;
        const emojiUnified = emoji.unified ? emoji.unified.toLowerCase() : emoji.name.toLowerCase();

        content = (
            <img
                alt={'emoji image'}
                data-testid={emoji.short_names}
                src={imgTrans}
                className={`emojisprite emoji-category-${emoji.category} emoji-${emojiUnified}`}
                id={`emoji-${emojiUnified}`}
                aria-label={formatMessage(
                    {
                        id: 'emoji_picker_item.emoji_aria_label',
                        defaultMessage: '{emojiName} emoji',
                    },
                    {
                        emojiName: (emojiName).replace(/_/g, ' '),
                    },
                )}
                role='button'
            />
        );
    } else {
        content = (
            <img
                alt={'custom emoji image'}
                data-testid={emoji.name}
                src={getEmojiImageUrl(emoji)}
                className={'emoji-category--custom'}
            />
        );
    }

    return (
        <div
            className={itemClassName}
            onClick={handleClick}
            onMouseOver={throttledMouseOver}
        >
            <div data-testid='emojiItem'>
                {content}
            </div>
        </div>
    );
}

function areEqual(prevProps: Props, nextProps: Props) {
    return (
        prevProps.isSelected === nextProps.isSelected
    );
}

export default memo(EmojiPickerItem, areEqual);
