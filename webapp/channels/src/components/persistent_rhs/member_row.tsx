// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

    return (
        <div
            className='channel-members-rhs__member'
            style={{height: '48px'}}
        >
            <span className='ProfileSpan'>
                <div className='channel-members-rhs__avatar'>
                    <ProfilePicture
                        size='sm'
                        status={status}
                        isBot={user.is_bot}
                        userId={user.id}
                        username={displayName}
                        src={userProfileSrc}
                    />
                </div>
                <ProfilePopover
                    triggerComponentClass='profileSpan_userInfo'
                    userId={user.id}
                    src={userProfileSrc}
                    hideStatus={user.is_bot}
                >
                    <span className='channel-members-rhs__display-name'>
                        {displayName}
                    </span>
                    {displayName !== user.username && (
                        <span className='channel-members-rhs__username'>
                            {'@'}{user.username}
                        </span>
                    )}
                    <CustomStatusEmoji
                        userID={user.id}
                        showTooltip={true}
                        emojiSize={16}
                        spanStyle={{
                            display: 'flex',
                            flex: '0 0 auto',
                            alignItems: 'center',
                        }}
                        emojiStyle={{
                            marginLeft: '8px',
                            alignItems: 'center',
                        }}
                    />
                </ProfilePopover>
            </span>
        </div>
    );
}
