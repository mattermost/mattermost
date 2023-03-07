// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties, memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {EmojiCategory} from '@mattermost/types/emojis';

interface Props {
    categoryName: EmojiCategory;
    style: CSSProperties;
}

function EmojiPickerCategoryRow({categoryName, style}: Props) {
    return (
        <div
            className='emoji-picker-items__container'
            style={style}
        >
            <div
                className='emoji-picker__category-header'
                id={`emojipickercat-${categoryName}`}
            >
                <FormattedMessage id={`emoji_picker.${categoryName}`}/>
            </div>
        </div>
    );
}

export default memo(EmojiPickerCategoryRow);
