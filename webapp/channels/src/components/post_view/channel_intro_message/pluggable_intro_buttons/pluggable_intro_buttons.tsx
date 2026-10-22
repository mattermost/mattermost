// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Icon} from '@mattermost/compass-ui/components/icon';
import {TileButton} from '@mattermost/compass-ui/components/tile-button';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import type {ChannelIntroButtonAction} from 'types/store/plugins';

type Props = {
    channel: Channel;
    channelMember?: ChannelMembership;
    pluginButtons: ChannelIntroButtonAction[];
};

const PluggableIntroButtons = React.memo(({
    channel,
    pluginButtons,
    channelMember,
}: Props) => {
    const channelIsArchived = channel.delete_at !== 0;

    if (channelIsArchived || pluginButtons.length === 0 || !channelMember) {
        return null;
    }

    const buttons = pluginButtons.map((buttonProps) => {
        return (
            <TileButton
                key={buttonProps.id}
                onClick={() => buttonProps.action?.(channel, channelMember)}
                icon={<Icon glyph={buttonProps.icon}/>}
                label={buttonProps.text}
            />
        );
    });

    return <>{buttons}</>;
});
PluggableIntroButtons.displayName = 'PluggableIntroButtons';

export default PluggableIntroButtons;
