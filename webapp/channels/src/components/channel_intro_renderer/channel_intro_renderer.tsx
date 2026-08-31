// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {ChannelIntroRegistration} from 'types/store/plugins';

export default function ChannelIntroRenderer({registration, channel}: {
    registration: ChannelIntroRegistration;
    channel: Channel;
}) {
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
