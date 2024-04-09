// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SharedUserIndicator from 'components/shared_user_indicator';

type Props = {
    fullname: string;
    username: string;
    remoteId?: string;
}
const FullName = ({
    fullname,
    username,
    remoteId,
}: Props) => {
    if (!fullname) {
        return null;
    }

    let sharedIcon;
    if (remoteId) {
        sharedIcon = (
            <SharedUserIndicator
                id={`sharedUserIndicator-${username}`}
                className='shared-user-icon'
                withTooltip={true}
            />
        );
    }
    return (
        <div
            data-testid={`popover-fullname-${username}`}
            className='overflow--ellipsis pb-1'
        >
            <span className='user-profile-popover__heading'>{fullname}</span>
            {sharedIcon}
        </div>
    );
};
export default FullName;
