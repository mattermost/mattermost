// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import ProfilePicture from 'components/profile_picture';

type Props = {
    user: UserProfile;

    // The grid row: `.name`, `.display_name--text`, `.email--text`.
    testId?: string;
};

const UserGridName = ({
    user,
    testId,
}: Props) => {
    return (
        <div className='UserGrid_nameRow'>
            <ProfilePicture
                src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                status={user.status}
                size='md'
            />

            <div
                className='UserGrid_name'
                data-testid={testId ? `${testId}.name` : undefined}
            >
                <span data-testid={testId ? `${testId}.display_name--text` : undefined}>
                    {`${user.username} - ${user.first_name} ${user.last_name}`}
                </span>
                <span
                    className='ug-email'
                    data-testid={testId ? `${testId}.email--text` : undefined}
                >
                    {user.email}
                </span>
            </div>
        </div>
    );
};

export default UserGridName;
