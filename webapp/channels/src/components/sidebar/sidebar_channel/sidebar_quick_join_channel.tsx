// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import './sidebar_quick_join_channel.scss';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {joinChannel} from 'mattermost-redux/actions/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {dismissQuickJoinChannel} from 'actions/views/channel_sync';

import type {GlobalState} from 'types/store';

type Props = {
    channelId: string;
};

const SidebarQuickJoinChannel: React.FC<Props> = ({channelId}) => {
    const dispatch = useDispatch();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const teamId = useSelector(getCurrentTeamId);
    const userId = useSelector(getCurrentUserId);

    const handleJoin = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch(joinChannel(userId, teamId, channelId));
    }, [dispatch, userId, teamId, channelId]);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch(dismissQuickJoinChannel(teamId, channelId));
    }, [dispatch, teamId, channelId]);

    if (!channel) {
        return null;
    }

    const icon = channel.type === 'O' ? 'icon-globe' : 'icon-lock-outline';

    return (
        <li className='SidebarChannel quick-join-item'>
            <button className='SidebarLink sidebar-item--quick-join'>
                <i className={`icon ${icon}`}/>
                <span className='SidebarChannelLinkLabel'>
                    {channel.display_name}
                </span>
                <div className='quick-join-actions'>
                    <button
                        className='quick-join-btn join-btn'
                        title='Join channel'
                        onClick={handleJoin}
                    >
                        <i className='icon icon-plus'/>
                    </button>
                    <button
                        className='quick-join-btn dismiss-btn'
                        title='Dismiss'
                        onClick={handleDismiss}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </div>
            </button>
        </li>
    );
};

export default SidebarQuickJoinChannel;
