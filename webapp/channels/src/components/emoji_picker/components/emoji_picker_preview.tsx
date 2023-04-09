// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {Emoji} from '@mattermost/types/emojis';
import {getEmojiImageUrl, isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';

import imgTrans from 'images/img_trans.gif';

interface Props {
    emoji?: Emoji;
}

function EmojiPickerPreview({emoji}: Props) {
    if (!emoji) {
        return (
            <div className='emoji-picker__preview emoji-picker__preview-placeholder'>
                <FormattedMessage
                    id='emoji_picker.emojiPicker'
                    defaultMessage='Select an Emoji'
                />
            </div>
        );
    }

    let aliases;
    let previewImage;

    if (isSystemEmoji(emoji)) {
        aliases = emoji.short_names;
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
            </div>
        </div>
    );
}

export default memo(EmojiPickerPreview);
