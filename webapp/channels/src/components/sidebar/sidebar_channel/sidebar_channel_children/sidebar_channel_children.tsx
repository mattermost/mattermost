// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {logSidebarChannelChildrenRenderError} from 'selectors/sidebar_channel_children';

import type {SidebarChannelChildrenRegistration} from 'types/store/plugins';

type ErrorBoundaryProps = {
    pluginId: string;
    children: React.ReactNode;
};

// Hides a plugin's component if it throws, so a plugin bug can't blank the sidebar.
class SidebarChannelChildrenErrorBoundary extends React.PureComponent<ErrorBoundaryProps, {hasError: boolean}> {
    state = {hasError: false};

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    componentDidCatch(error: Error) {
        logSidebarChannelChildrenRenderError(this.props.pluginId, error);
    }

    render() {
        return this.state.hasError ? null : this.props.children;
    }
}

type Props = {
    registrations: SidebarChannelChildrenRegistration[];
    channel: Channel;
    currentTeamName: string;
    isCurrentChannel: boolean;
};

export default function SidebarChannelChildren({registrations, channel, currentTeamName, isCurrentChannel}: Props) {
    return (
        <div className='SidebarChannel__children'>
            {registrations.map(({id, pluginId, component: Component}) => (
                <SidebarChannelChildrenErrorBoundary
                    key={`${id}:${channel.id}`}
                    pluginId={pluginId}
                >
                    <Component
                        channel={channel}
                        currentTeamName={currentTeamName}
                        isCurrentChannel={isCurrentChannel}
                    />
                </SidebarChannelChildrenErrorBoundary>
            ))}
        </div>
    );
}
