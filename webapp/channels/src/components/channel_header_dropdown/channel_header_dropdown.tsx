// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FC} from 'react';
import React, {memo} from 'react';

import {ChannelHeaderDropdownItems} from 'components/channel_header_dropdown';
import Menu from 'components/widgets/menu/menu';

import {localizeMessage} from 'utils/utils';

const ChannelHeaderDropdown: FC = () => (
    <Menu
        id='channelHeaderDropdownMenu'
        ariaLabel={localizeMessage('channel_header.menuAriaLabel', 'Channel Menu').toLowerCase()}
    >
        <ChannelHeaderDropdownItems isMobile={false}/>
    </Menu>
);

export default memo(ChannelHeaderDropdown);
