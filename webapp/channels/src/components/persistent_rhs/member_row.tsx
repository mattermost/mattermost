// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import StatusIcon from 'components/status_icon';
import ProfilePopover from 'components/profile_popover';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import {makeGetCustomStatus} from 'selectors/views/custom_status';

import type {GlobalState} from 'types/store';

import './member_row.scss';

interface Props {
    user: UserProfile;
    status: string;
    isAdmin: boolean;
}

export default function MemberRow({user, status, isAdmin}: Props) {
    const getCustomStatus = makeGetCustomStatus();
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, user.id));

    const displayName = user.nickname ||
        (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '') ||
        user.username;

    const isOffline = status === 'offline';

    return (
        <ProfilePopover
            triggerComponentClass='member-row__trigger'
            userId={user.id}
            src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
        >
            <div className={classNames('member-row', {'member-row--offline': isOffline})}>
                <div className='member-row__avatar-container'>
                    <img
                        className='member-row__avatar'
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        alt={displayName}
                    />
                    <StatusIcon
                        className='member-row__status-icon'
                        status={status}
                    />
                </div>
                <div className='member-row__info'>
                    <div className='member-row__name-row'>
                        <span className='member-row__name'>{displayName}</span>
                        {user.is_bot && (
                            <span className='member-row__bot-tag'>{'BOT'}</span>
                        )}
                    </div>
                    {customStatus?.text && (
                        <div className='member-row__custom-status'>
                            <CustomStatusEmoji
                                userID={user.id}
                                emojiSize={14}
                                showTooltip={false}
                            />
                            <span className='member-row__custom-status-text'>
                                {customStatus.text}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </ProfilePopover>
    );
}
