// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

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
    const intl = useIntl();

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
            title={
                <FormattedMessage {...category.label}/>
            }
        >
            <a
                className={className}
                href='#'
                onClick={handleClick}
                aria-label={intl.formatMessage(category.label)}
            >
                <i className={category.iconClassName}/>
            </a>
        </WithTooltip>
    );
}

export default memo(EmojiPickerCategory);
