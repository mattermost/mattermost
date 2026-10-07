// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import {ActionButton} from '@mattermost/compass-ui/components/action-button';
import {Icon} from '@mattermost/compass-ui/components/icon';

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
            <ActionButton
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
