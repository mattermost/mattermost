// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ChannelHeaderDropdownItems} from 'components/channel_header_dropdown';
import Menu from 'components/widgets/menu/menu';

import {localizeMessage} from 'utils/utils';

export default class ChannelHeaderDropdown extends React.PureComponent {
    render() {
        return (
            <Menu
                id='channelHeaderDropdownMenu'
                ariaLabel={localizeMessage('channel_header.menuAriaLabel', 'Channel Menu').toLowerCase()}
            >
                <ChannelHeaderDropdownItems isMobile={false}/>
            </Menu>
        );
    }
}
