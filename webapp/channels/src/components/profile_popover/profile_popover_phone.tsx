// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

type Props = {
    attribute: UserPropertyField;
    userProfile: UserProfile;
}

const ProfilePopoverPhone = ({attribute, userProfile}: Props) => {
    const phone = userProfile.custom_profile_attributes?.[attribute.id] as string;

    if (!phone) {
        return null;
    }

    function handlePhoneClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        window.open(`tel:${phone}`);
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
                href={`tel:${phone}`}
                onClick={handlePhoneClick}
            >
                {phone}
            </a>
        </div>
    );
};

export default ProfilePopoverPhone;
