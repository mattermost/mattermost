// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {markChannelAsRead} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {GlobalState} from 'types/store';
import type {ChannelViewRegistration} from 'types/store/plugins';

type Props = {
    registration: ChannelViewRegistration;
    channelId: string;
    focusedPostId?: string;
};

export default function ChannelViewPluginComponent({registration, channelId, focusedPostId}: Props) {
    const dispatch = useDispatch();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const teamId = useSelector(getCurrentTeamId);

    // Stands in for PostList, which marks the channel as read after loading posts.
    useEffect(() => {
        if (channelId) {
            dispatch(markChannelAsRead(channelId));
        }
    }, [channelId, dispatch]);

    if (!channel) {
        return null;
    }

    const Component = registration.component;
    return (
        <div
            id='channelViewPluginComponent'
            className='channel-view-plugin-component'
            data-plugin-id={registration.pluginId}
        >
            <PluggableErrorBoundary
                key={`${registration.id}:${channel.id}`}
                pluginId={registration.pluginId}
            >
                <Component
                    channel={channel}
                    channelId={channel.id}
                    teamId={teamId}
                    focusedPostId={focusedPostId}
                />
            </PluggableErrorBoundary>
        </div>
    );
}
