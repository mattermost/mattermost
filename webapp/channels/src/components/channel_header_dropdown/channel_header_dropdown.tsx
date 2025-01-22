// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import {ChannelHeaderDropdownItems} from 'components/channel_header_dropdown';
import Menu from 'components/widgets/menu/menu';

const ChannelHeaderDropdown = ({ariaLabel}: {
    ariaLabel: string;
}) =>
    (
        <Menu
            id='channelHeaderDropdownMenu'
            ariaLabel={ariaLabel}
        >
            <ChannelHeaderDropdownItems isMobile={false}/>
        </Menu>
    );

export default memo(ChannelHeaderDropdown);
