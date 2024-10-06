// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import Avatar from 'components/widgets/users/avatar';

type Props = {
    username: string;
    displayName: string;
    email: string;
    userId: string;
    lastPictureUpdate: number;
};

const GroupUsersRow = ({
    username,
    displayName,
    email,
    userId,
    lastPictureUpdate,
}: Props) => {
    return (
        <div className='group-users-row'>
            <Avatar
                username={username}
                url={Client4.getProfilePictureUrl(
                    userId,
                    lastPictureUpdate,
                )}
                size='lg'
            />
            <div className='user-data'>
                <div className='name-row'>
                    <span className='username'>
                        {'@' + username}
                    </span>
                    {'-'}
                    <span className='display-name'>
                        {displayName}
                    </span>
                </div>
                <div>
                    <span className='email-label'>
                        <FormattedMessage
                            id='admin.group_settings.group_details.group_users.email'
                            defaultMessage='Email:'
                        />
                    </span>
                    <span className='email'>{email}</span>
                </div>
            </div>
        </div>
    );
};

export default React.memo(GroupUsersRow);
