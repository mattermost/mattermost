// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {ChannelDecoratorRegistration} from 'types/store/plugins';

type Props = {
    registration: ChannelDecoratorRegistration;
    channel: Channel;
};

export default function ChannelDecoratorRenderer({registration, channel}: Props) {
    const Component = registration.component;
    return (
        <PluggableErrorBoundary
            key={`${registration.id}:${channel.id}`}
            pluginId={registration.pluginId}
        >
            <Component channel={channel}/>
        </PluggableErrorBoundary>
    );
}
