// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import './sidebar_quick_join_channel.scss';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {joinChannel} from 'mattermost-redux/actions/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {dismissQuickJoinChannel} from 'actions/views/channel_sync';
import SidebarBaseChannelIcon from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon';

import type {GlobalState} from 'types/store';

type Props = {
    channelId: string;
};

const SidebarQuickJoinChannel: React.FC<Props> = ({channelId}) => {
    const dispatch = useDispatch();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const teamId = useSelector(getCurrentTeamId);
    const userId = useSelector(getCurrentUserId);
    const [isJoining, setIsJoining] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);

    const handleJoin = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isJoining || isDismissing) {
            return;
        }
        setIsJoining(true);
        await dispatch(joinChannel(userId, teamId, channelId));
    }, [dispatch, userId, teamId, channelId, isJoining, isDismissing]);

    const handleDismiss = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isJoining || isDismissing) {
            return;
        }
        setIsDismissing(true);
        await dispatch(dismissQuickJoinChannel(teamId, channelId));
    }, [dispatch, teamId, channelId, isJoining, isDismissing]);

    if (!channel) {
        return null;
    }

    return (
        <li className='SidebarChannel quick-join-item'>
            <button className='SidebarLink sidebar-item--quick-join'>
                <SidebarBaseChannelIcon
                    channelType={channel.type}
                    customIcon={channel.props?.custom_icon}
                />
                <span className='SidebarChannelLinkLabel'>
                    {channel.display_name}
                </span>
                <div className='quick-join-actions'>
                    <button
                        className={`quick-join-btn join-btn ${isJoining ? 'loading' : ''}`}
                        title='Join channel'
                        onClick={handleJoin}
                        disabled={isJoining || isDismissing}
                    >
                        <i className='icon icon-plus'/>
                    </button>
                    <button
                        className={`quick-join-btn dismiss-btn ${isDismissing ? 'loading' : ''}`}
                        title='Dismiss'
                        onClick={handleDismiss}
                        disabled={isJoining || isDismissing}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </div>
            </button>
        </li>
    );
};

export default SidebarQuickJoinChannel;
