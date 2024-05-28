// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {EmojiCategory} from '@mattermost/types/emojis';

import type {Category, CategoryOrEmojiRow} from 'components/emoji_picker/types';
import WithTooltip from 'components/with_tooltip';

export interface Props {
    category: Category;
    categoryRowIndex: CategoryOrEmojiRow['index'];
    selected: boolean;
    enable: boolean;
    onClick: (categoryRowIndex: CategoryOrEmojiRow['index'], categoryName: EmojiCategory, firstEmojiId: string) => void;
}

function EmojiPickerCategory({category, categoryRowIndex, selected, enable, onClick}: Props) {
    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();

        if (enable) {
            const firstEmojiId = category?.emojiIds?.[0] ?? '';

            onClick(categoryRowIndex, category.name, firstEmojiId);
        }
    };

    const className = classNames('emoji-picker__category', {
        'emoji-picker__category--selected': selected,
        disable: !enable,
    });

    return (
        <WithTooltip
            id={`emojiPickerCategoryTooltip-${category.name}`}
            placement='bottom'
            title={
                <FormattedMessage
                    id={`emoji_picker.${category.name}`}
                    defaultMessage={category.message}
                />
            }
        >
            <a
                className={className}
                href='#'
                onClick={handleClick}
                aria-label={category.id}
            >
                <i className={category.className}/>
            </a>
        </WithTooltip>
    );
}

export default memo(EmojiPickerCategory);
