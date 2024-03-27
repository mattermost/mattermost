// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SharedUserIndicator from 'components/shared_user_indicator';

type Props = {
    fullname: string;
    username: string;
    remoteId?: string;
}
const ProfilePopoverFullName = ({
    fullname,
    username,
    remoteId,
}: Props) => {
    if (!fullname) {
        return null;
    }

    return (
        <div
            data-testid={`popover-fullname-${username}`}
            className='user-profile-popover__heading'
        >
            <span title={fullname}>
                {fullname}
            </span>
            {remoteId && (
                <SharedUserIndicator
                    className='shared-user-icon'
                />
            )}
        </div>
    );
};
export default ProfilePopoverFullName;
