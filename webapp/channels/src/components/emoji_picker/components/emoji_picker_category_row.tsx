// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {CSSProperties} from 'react';
import {FormattedMessage} from 'react-intl';

import type {EmojiCategory} from '@mattermost/types/emojis';

import {EMOJI_CATEGORIES} from '../constants';

interface Props {
    categoryName: EmojiCategory;
    style: CSSProperties;
}

function EmojiPickerCategoryRow({categoryName, style}: Props) {
    const category = EMOJI_CATEGORIES[categoryName];

    return (
        <div
            className='emoji-picker__row'
            style={style}
            role='row'
        >
            <div
                className='emoji-picker__category-header'
                id={`emojipickercat-${categoryName}`}
            >
                <FormattedMessage {...category.label}/>
            </div>
        </div>
    );
}

export default memo(EmojiPickerCategoryRow);
