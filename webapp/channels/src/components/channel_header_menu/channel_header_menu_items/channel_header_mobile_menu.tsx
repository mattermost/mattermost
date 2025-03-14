// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {memo} from 'react';

import type {Channel} from '@mattermost/types/channels';

import * as Menu from 'components/menu';

import MobileChannelHeaderPlugins from '../menu_items/mobile_channel_header_plugins';

type Props = {
    isMobile: boolean;
    channel: Channel;
    pluginItems: ReactNode[];
}

const ChannelHeaderMobileMenu = (props: Props): JSX.Element => {
    if (!props.isMobile) {
        return <></>;
    }
    return (
        <>
            <MobileChannelHeaderPlugins
                channel={props.channel}
                isDropdown={true}
            />
            <Menu.Separator/>
            {props.pluginItems}
        </>
    );
};

export default memo(ChannelHeaderMobileMenu);
