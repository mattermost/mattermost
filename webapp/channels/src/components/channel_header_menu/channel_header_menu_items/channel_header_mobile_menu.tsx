// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {memo} from 'react';

import type {Channel} from '@mattermost/types/channels';

import MobileChannelHeaderPlugins from '../menu_items/mobile_channel_header_plugins';

type Props = {
    isMobile: boolean;
    channel: Channel;
    pluginItems: ReactNode[];
}

const ChannelHeaderMobileMenu = (props: Props): JSX.Element => {
    return (
        <>
            {props.isMobile && props.pluginItems}
            {props.isMobile && (
                <MobileChannelHeaderPlugins
                    channel={props.channel}
                    isDropdown={true}
                />
            )}
        </>
    );
};

// Exported for tests
export default memo(ChannelHeaderMobileMenu);
