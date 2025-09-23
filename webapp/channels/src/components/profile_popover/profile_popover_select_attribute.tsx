// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption, UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

type Props = {
    attribute: UserPropertyField;
    userProfile: UserProfile;
}

const ProfilePopoverSelectAttribute = ({attribute, userProfile}: Props) => {
    const attributeValue = userProfile.custom_profile_attributes?.[attribute.id];
    if (!attributeValue) {
        return null;
    }

    const options = attribute.attrs?.options as PropertyFieldOption[];
    if (!options) {
        return null;
    }

    let displayValue = '';
    if (Array.isArray(attributeValue)) {
        // Handle multiselect
        displayValue = attributeValue.map((value) => {
            const option = options.find((o) => o.id === value);
            return option?.name;
        }).filter(Boolean).join(', ');
    } else {
        // Handle single select
        const option = options.find((o) => o.id === attributeValue);
        displayValue = option?.name || '';
    }

    if (!displayValue) {
        return null;
    }

    return (
        <p
            aria-labelledby={`user-popover__custom_attributes-title-${attribute.id}`}
            className='user-popover__subtitle-text'
        >
            {displayValue}
        </p>
    );
};

export default ProfilePopoverSelectAttribute;
