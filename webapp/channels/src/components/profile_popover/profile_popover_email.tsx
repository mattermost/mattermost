// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    email?: string;
    haveOverrideProp?: boolean;
    isBot?: boolean;
}
const ProfilePopoverEmail = ({
    email,
    haveOverrideProp,
    isBot,
}: Props) => {
    if (!email || isBot || haveOverrideProp) {
        return null;
    }

    return (
        <div
            title={email}
            className='user-profile-popover__email'

        >
            <i
                className='icon icon-email-outline'
                aria-hidden='true'
            />
            <a
                href={'mailto:' + email}
            >
                {email}
            </a>
        </div>
    );
};

export default ProfilePopoverEmail;
