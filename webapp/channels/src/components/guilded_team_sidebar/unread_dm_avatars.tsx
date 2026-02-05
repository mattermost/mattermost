// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {getUnreadDmChannelsWithUsers} from 'selectors/views/guilded_layout';

import './unread_dm_avatars.scss';

const MAX_AVATARS = 5;

export default function UnreadDmAvatars() {
    const unreadDms = useSelector(getUnreadDmChannelsWithUsers);

    if (unreadDms.length === 0) {
        return <div className='unread-dm-avatars' />;
    }

    const displayedDms = unreadDms.slice(0, MAX_AVATARS);
    const overflow = unreadDms.length - MAX_AVATARS;

    return (
        <div className='unread-dm-avatars'>
            {displayedDms.map((dm) => (
                <div
                    key={dm.channel.id}
                    className='unread-dm-avatars__avatar'
                    title={dm.user.username}
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
                </div>
            ))}
            {overflow > 0 && (
                <div className='unread-dm-avatars__overflow'>
                    +{overflow}
                </div>
            )}
        </div>
    );
}
