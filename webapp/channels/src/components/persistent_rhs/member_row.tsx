// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import ProfilePicture from 'components/profile_picture';
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

    const userProfileSrc = Client4.getProfilePictureUrl(user.id, user.last_picture_update);

    const isOffline = status === 'offline';

    return (
        <ProfilePopover
            triggerComponentClass={classNames('member-row', {'member-row--offline': isOffline})}
            userId={user.id}
            src={userProfileSrc}
            hideStatus={user.is_bot}
            placement='left-start'
        >
            <div className='member-row__avatar'>
                <ProfilePicture
                    size='sm'
                    status={status}
                    isBot={user.is_bot}
                    username={displayName}
                    src={userProfileSrc}
                />
            </div>
            <div className='member-row__info'>
                <span className='member-row__name'>
                    {displayName}
                </span>
                {(customStatus?.emoji || customStatus?.text) && (
                    <div className='member-row__status-row'>
                        <CustomStatusEmoji
                            userID={user.id}
                            emojiSize={12}
                            showTooltip={false}
                        />
                        {customStatus?.text && (
                            <span className='member-row__status-text'>
                                {customStatus.text}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </ProfilePopover>
    );
}
