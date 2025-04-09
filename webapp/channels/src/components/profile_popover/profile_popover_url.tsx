// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

type Props = {
    attribute: UserPropertyField;
    userProfile: UserProfile;
}

const ProfilePopoverUrl = ({attribute, userProfile}: Props) => {
    const url = userProfile.custom_profile_attributes?.[attribute.id] as string;

    if (!url) {
        return null;
    }

    return (
        <div
            title={url}
            className='user-profile-popover__url'
        >
            <i
                className='icon icon-url-outline'
                aria-hidden='true'
                data-testid='url-icon'
            />
            <a
                href={url}
            >
                {url}
            </a>
        </div>
    );
};

export default ProfilePopoverUrl;
