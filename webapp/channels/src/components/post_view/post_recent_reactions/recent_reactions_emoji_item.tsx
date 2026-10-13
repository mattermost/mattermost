// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import type {Emoji} from '@mattermost/types/emojis';

import {getEmojiImageUrl, getEmojiName} from 'mattermost-redux/utils/emoji_utils';

type Props = {
    emoji: Emoji;
    onItemClick: (emoji: Emoji) => void;
    order?: number;
};
const EmojiItem = ({emoji, onItemClick, order}: Props) => {
    const {formatMessage} = useIntl();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onItemClick(emoji);
    };

    const emojiName = getEmojiName(emoji);
    const ariaLabel = formatMessage(
        {
            id: 'emoji_picker_item.emoji_aria_label',
            defaultMessage: '{emojiName} emoji',
        },
        {
            emojiName: (emojiName).replace(/_/g, ' '),
        },
    );

    return (
        <IconButton
            id={`recent_reaction_${order}`}
            data-testid='post-menu__item_emoji'
            size='small'
            padding='compact'
            className={classNames('post-menu__item', 'post-menu__emoticon')}
            icon={
                <span
                    className='emoticon--post-menu'
                    style={{backgroundImage: `url(${getEmojiImageUrl(emoji)})`, backgroundColor: 'transparent'}}
                    aria-hidden={true}
                />
            }
            aria-label={ariaLabel}
            onClick={handleClick}
        />
    );
};

export default EmojiItem;
