// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {EmojiCategory} from '@mattermost/types/emojis';

import type {Category, CategoryOrEmojiRow} from 'components/emoji_picker/types';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {Constants} from 'utils/constants';

interface Props {
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
        <OverlayTrigger
            trigger={['hover', 'focus']}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='bottom'
            overlay={
                <Tooltip
                    id='skinTooltip'
                    className='emoji-tooltip'
                >
                    <FormattedMessage
                        id={`emoji_picker.${category.name}`}
                        defaultMessage={category.message}
                    />
                </Tooltip>
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
        </OverlayTrigger>
    );
}

export default memo(EmojiPickerCategory);
