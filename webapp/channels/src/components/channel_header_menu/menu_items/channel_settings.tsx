// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    FolderMoveOutlineIcon,
    ChevronRightIcon,
    CogOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import * as Menu from 'components/menu';

import MenuItemEditChannelSettings from './edit_channel_settings';

type Props = {
    channel: Channel;
    isReadonly: boolean;
    isDefault: boolean;
}

const ChannelSettings = ({channel, isReadonly, isDefault}: Props): JSX.Element => {
    const {formatMessage} = useIntl();
    return (
        <Menu.SubMenu
            id={'channelSettings'}
            labels={
                <FormattedMessage
                    id='channelSettings'
                    defaultMessage='Channel Settings'
                />
            }
            leadingElement={<CogOutlineIcon size={18}/>}
            trailingElements={<ChevronRightIcon size={16}/>}
            menuId={'channelSettings-menu'}
            menuAriaLabel={formatMessage({id: 'channelSettings', defaultMessage: 'Channel Settings'})}
        >
            <MenuItemEditChannelSettings
                isReadonly={isReadonly}
                isDefault={isDefault}
                channel={channel}
            />

        </Menu.SubMenu>
    );
};

export default memo(ChannelSettings);
