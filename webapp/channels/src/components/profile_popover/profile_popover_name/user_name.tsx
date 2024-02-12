// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type Props = {
    hasFullName: boolean;
    username: string;
}

const UserName = ({
    hasFullName,
    username,
}: Props) => {
    const userNameClass = classNames('overflow--ellipsis pb-1', {'user-profile-popover__heading': !hasFullName});
    return (
        <div
            id='userPopoverUsername'
            className={userNameClass}
        >
            {`@${username}`}
        </div>
    );
};

export default UserName;
