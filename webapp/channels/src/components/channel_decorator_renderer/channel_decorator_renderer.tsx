// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import webSocketClient from 'client/web_websocket_client';
import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {ChannelDecoratorRegistration} from 'types/store/plugins';

type Props = {
    registration: ChannelDecoratorRegistration;
    channel: Channel;
};

export default function ChannelDecoratorRenderer({registration, channel}: Props) {
    const theme = useSelector(getTheme);

    // Cast to any: the declared prop type is the minimum contract ({channel}), but we inject
    // theme and webSocketClient as bonus props — same pattern as pluggable.tsx.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Component = registration.component as React.ComponentType<any>;
    return (
        <PluggableErrorBoundary
            key={`${registration.id}:${channel.id}`}
            pluginId={registration.pluginId}
        >
            <Component
                channel={channel}
                theme={theme}
                webSocketClient={webSocketClient}
            />
        </PluggableErrorBoundary>
    );
}
