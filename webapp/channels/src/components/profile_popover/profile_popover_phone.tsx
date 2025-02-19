// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    phone?: string;
}
const ProfilePopoverPhone = ({phone}: Props) => {
    if (!phone) {
        return null;
    }

    return (
        <div
            title={phone}
            className='user-profile-popover__phone'

        >
            <i
                className='icon icon-phone-outline'
                aria-hidden='true'
                aria-label='phone icon'
            />
            <a
                href={'tel:' + phone}
            >
                {phone}
            </a>
        </div>
    );
};

export default ProfilePopoverPhone;
