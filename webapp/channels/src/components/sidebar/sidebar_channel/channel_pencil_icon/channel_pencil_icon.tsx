// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import './channel_pencil_icon.scss';

type Props = {
    hasDraft: boolean;
};

function ChannelPencilIcon({hasDraft}: Props) {
    if (hasDraft) {
        return (
            <i
                data-testid='lhs.channel_list.channel.draft--text'
                className='icon icon-pencil-outline channel-pencil-icon'
            />
        );
    }
    return null;
}

export default memo(ChannelPencilIcon);
