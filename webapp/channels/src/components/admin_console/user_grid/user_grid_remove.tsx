// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

type Props = {
    user: UserProfile;
    removeUser: (user: UserProfile) => void;
    isDisabled?: boolean;
}

const UserGridRemove = ({
    user,
    removeUser,
    isDisabled,
}: Props) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (!isDisabled) {
            removeUser(user);
        }
    };

    return (
        <div className='UserGrid_removeRow'>
            <a
                onClick={handleClick}
                href='#'
                role='button'
                className={isDisabled ? 'disabled' : ''}
            >
                <FormattedMessage
                    id='admin.user_grid.remove'
                    defaultMessage='Remove'
                />
            </a>
        </div>
    );
};

export default UserGridRemove;
