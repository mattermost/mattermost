// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
        <p
            id='userPopoverUsername'
            className={
                hasFullName ? 'user-profile-popover__non-heading' : 'user-profile-popover__heading'
            }
            title={username}
        >
            {`@${username}`}
        </p>
    );
};

export default ProfilePopoverUserName;
