// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Emoji from 'components/emoji/render_emoji';

type Props = {

    /** The emoji itself, or a custom emoji's name between colons. */
    emoji: string;
};

const CUSTOM_EMOJI = /^:([\w+-]+):$/;

/** A sub-item's emoji in the icon's place, at the icon's size. */
const SidebarChannelSubItemEmoji = ({emoji}: Props) => {
    const custom = CUSTOM_EMOJI.exec(emoji);
    return (
        <span
            className='SidebarChannelSubItem__icon SidebarChannelSubItem__emoji'
            aria-hidden='true'
        >
            {custom ? (
                <Emoji
                    emojiName={custom[1]}
                    size={16}
                />
            ) : emoji}
        </span>
    );
};

export default SidebarChannelSubItemEmoji;
