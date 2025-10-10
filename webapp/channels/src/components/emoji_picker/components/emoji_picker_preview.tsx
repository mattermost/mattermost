// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import {getEmojiImageUrl, isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';

import WithTooltip from 'components/with_tooltip';

import imgTrans from 'images/img_trans.gif';

interface Props {
    emoji?: Emoji;
}

function EmojiPickerPreview({emoji}: Props) {
    if (!emoji) {
        return (
            <div className='emoji-picker__preview emoji-picker__preview-placeholder'>
                <FormattedMessage
                    id='emoji_picker.emojiPicker.previewPlaceholder'
                    defaultMessage='Select an Emoji'
                />
            </div>
        );
    }

    let aliases;
    let previewImage;
    let description = '';

    if (isSystemEmoji(emoji)) {
        aliases = emoji.short_names;
        description = emoji.name || '';
        previewImage = (
            <span className='sprite-preview'>
                <img
                    id='emojiPickerSpritePreview'
                    alt={'emoji category image'}
                    src={imgTrans}
                    className={'emojisprite-preview emoji-category-' + emoji.category + ' emoji-' + emoji.unified.toLowerCase()}
                />
            </span>
        );
    } else {
        aliases = [emoji.name];
        description = ('description' in emoji && emoji.description) ? emoji.description : '';
        previewImage = (
            <img
                id='emojiPickerSpritePreview'
                alt={'emoji preview image'}
                className='emoji-picker__preview-image'
                src={getEmojiImageUrl(emoji)}
            />
        );
    }

    return (
        <div className='emoji-picker__preview'>
            <div className='emoji-picker__preview-image-box'>
                {previewImage}
            </div>
            <div className='emoji-picker__preview-image-label-box'>
                <span
                    className='emoji-picker__preview-name'
                    data-testid='emoji_picker_preview'
                >
                    {':' + aliases.join(': :') + ':'}
                </span>
                {description && (
                    <WithTooltip
                        title={description}
                    >
                        <span className='emoji-picker__preview-description'>
                            {description}
                        </span>
                    </WithTooltip>
                )}
            </div>
        </div>
    );
}

export default memo(EmojiPickerPreview);
