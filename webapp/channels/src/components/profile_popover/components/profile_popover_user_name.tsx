// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type Props = {
    hasFullName: boolean;
    username: string;
}

const ProfilePopoverUserName = ({
    hasFullName,
    username,
}: Props) => {
    return (
        <div
            id='userPopoverUsername'
            className={classNames({
                'user-profile-popover__heading': !hasFullName,
                'user-profile-popover__non-heading': hasFullName,
            })}
            title={username}
        >
            {`@${username}`}
        </div>
    );
};

export default ProfilePopoverUserName;
