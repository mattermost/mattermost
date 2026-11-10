// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {EmojiCategory} from '@mattermost/types/emojis';

import type {Category, CategoryOrEmojiRow} from 'components/emoji_picker/types';

export interface Props {
    category: Category;
    categoryRowIndex: CategoryOrEmojiRow['index'];
    selected: boolean;
    enable: boolean;
    onClick: (categoryRowIndex: CategoryOrEmojiRow['index'], categoryName: EmojiCategory, firstEmojiId: string) => void;
}

function EmojiPickerCategory({category, categoryRowIndex, selected, enable, onClick}: Props) {
    const intl = useIntl();
    const categoryLabel = intl.formatMessage(category.label);
    const CategoryIcon = category.icon;

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();

        if (enable) {
            const firstEmojiId = category?.emojiIds?.[0] ?? '';

            onClick(categoryRowIndex, category.name, firstEmojiId);
        }
    };

    return (
        <WithTooltip title={categoryLabel}>
            <IconButton
                aria-label={categoryLabel}
                aria-pressed={selected}
                active={selected}
                disabled={!enable}
                size='small'
                padding='compact'
                className={classNames('emoji-picker__category', {
                    disable: !enable,
                })}
                onClick={handleClick}
                icon={<Icon glyph={<CategoryIcon/>}/>}
            />
        </WithTooltip>
    );
}

export default memo(EmojiPickerCategory);
