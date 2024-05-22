// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import type {PluginComponent} from 'types/store/plugins';

type Props = {
    channel: Channel;
    channelMember?: ChannelMembership;
    pluginButtons: PluginComponent[];
}

const PluggableIntroButtons = React.memo((props: Props) => {
    const channelIsArchived = props.channel.delete_at !== 0;
    if (channelIsArchived || props.pluginButtons.length === 0) {
        return null;
    }

    const buttons = props.pluginButtons.map((buttonProps) => {
        return (
            <button
                key={buttonProps.id}
                className={'action-button'}
                onClick={() => buttonProps.action?.(props.channel, props.channelMember)}
            >
                {buttonProps.icon}
                {buttonProps.text}
            </button>
        );
    });

    return <>{buttons}</>;
});
PluggableIntroButtons.displayName = 'PluggableIntroButtons';

export default PluggableIntroButtons;
