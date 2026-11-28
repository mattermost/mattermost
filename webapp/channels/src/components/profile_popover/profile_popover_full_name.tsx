// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SharedUserIndicator from 'components/shared_user_indicator';

type Props = {
    fullname: string;
    remoteId?: string;
};
const ProfilePopoverFullName = ({
    fullname,
    remoteId,
}: Props) => {
    if (!fullname) {
        return null;
    }

    let sharedIcon = null;
    if (remoteId) {
        sharedIcon = (
            <SharedUserIndicator
                className='shared-user-icon'
                withTooltip={true}
            />
        );
    }

    return (
        <div
            data-testid='profile_popover.full_name--text'
            className='user-profile-popover__heading'
        >
            <p title={fullname}>{fullname}</p>
            {sharedIcon}
        </div>
    );
};

export default ProfilePopoverFullName;
