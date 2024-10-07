// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {ChannelHeaderDropdownItems} from 'components/channel_header_dropdown';
import Menu from 'components/widgets/menu/menu';

const ChannelHeaderDropdown = () => {
    const intl = useIntl();

    return (
        <Menu
            id='channelHeaderDropdownMenu'
            ariaLabel={intl.formatMessage({id: 'channel_header.menuAriaLabel', defaultMessage: 'Channel Menu'}).toLowerCase()}
        >
            <ChannelHeaderDropdownItems isMobile={false}/>
        </Menu>
    );
};

export default memo(ChannelHeaderDropdown);
