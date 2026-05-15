// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import webSocketClient from 'client/web_websocket_client';
import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {PostDecoratorRegistration} from 'types/store/plugins';

type Props = {
    registration: PostDecoratorRegistration;
    post: Post;
};

export default function PostDecoratorRenderer({registration, post}: Props) {
    const theme = useSelector(getTheme);

    // Cast to any: the declared prop type is the minimum contract ({post}), but we inject
    // theme and webSocketClient as bonus props — same pattern as pluggable.tsx.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Component = registration.component as React.ComponentType<any>;
    return (
        <PluggableErrorBoundary
            key={`${registration.id}:${post.id}`}
            pluginId={registration.pluginId}
        >
            <Component
                post={post}
                theme={theme}
                webSocketClient={webSocketClient}
            />
        </PluggableErrorBoundary>
    );
}
