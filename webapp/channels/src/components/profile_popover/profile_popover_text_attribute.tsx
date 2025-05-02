// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

type Props = {
    attribute: UserPropertyField;
    userProfile: UserProfile;
}

const ProfilePopoverTextAttribute = ({attribute, userProfile}: Props) => {
    const attributeValue = userProfile.custom_profile_attributes?.[attribute.id];
    if (!attributeValue) {
        return null;
    }

    return (
        <p
            aria-labelledby={`user-popover__custom_attributes-title-${attribute.id}`}
            className='user-popover__subtitle-text'
        >
            {attributeValue}
        </p>
    );
};

export default ProfilePopoverTextAttribute;
