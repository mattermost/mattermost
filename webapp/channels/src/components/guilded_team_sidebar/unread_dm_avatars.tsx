// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Client4} from 'mattermost-redux/client';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setDmMode} from 'actions/views/guilded_layout';
import {getUnreadDmChannelsWithUsers} from 'selectors/views/guilded_layout';

import './unread_dm_avatars.scss';

const MAX_AVATARS = 5;

export default function UnreadDmAvatars() {
    const history = useHistory();
    const dispatch = useDispatch();
    const unreadDms = useSelector(getUnreadDmChannelsWithUsers);
    const currentTeam = useSelector(getCurrentTeam);

    const handleDmClick = (channelId: string) => {
        dispatch(setDmMode(true));
        // Use channel ID directly - the /messages/@username pattern isn't recognized
        history.push(`/${currentTeam?.name}/channels/${channelId}`);
    };

    if (unreadDms.length === 0) {
        return <div className='unread-dm-avatars' />;
    }

    const displayedDms = unreadDms.slice(0, MAX_AVATARS);
    const overflow = unreadDms.length - MAX_AVATARS;

    return (
        <div className='unread-dm-avatars'>
            {displayedDms.map((dm) => (
                <button
                    key={dm.channel.id}
                    className='unread-dm-avatars__avatar'
                    title={dm.user.username}
                    onClick={() => handleDmClick(dm.channel.id)}
                >
                    <img
                        src={Client4.getProfilePictureUrl(dm.user.id, dm.user.last_picture_update)}
                        alt={dm.user.username}
                    />
                    <span
                        className={classNames('unread-dm-avatars__status', {
                            'unread-dm-avatars__status--online': dm.status === 'online',
                            'unread-dm-avatars__status--away': dm.status === 'away',
                            'unread-dm-avatars__status--dnd': dm.status === 'dnd',
                            'unread-dm-avatars__status--offline': dm.status === 'offline',
                        })}
                    />
                </button>
            ))}
            {overflow > 0 && (
                <div className='unread-dm-avatars__overflow'>
                    +{overflow}
                </div>
            )}
        </div>
    );
}
