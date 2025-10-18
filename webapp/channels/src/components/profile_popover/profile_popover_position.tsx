// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    position?: string;
    haveOverrideProp?: boolean;
}

const ProfilePopoverPosition = ({position, haveOverrideProp}: Props) => {
    // Return null if position is empty or we have an override prop
    if (!position || haveOverrideProp) {
        return null;
    }

    // Generate a unique ID for accessibility
    const titleId = `user-popover__position-title-${Math.random().toString(36).substring(2, 26)}`;

    return (
        <div className='user-popover__custom_attributes'>
            <strong
                id={titleId}
                className='user-popover__subtitle'
            >
                <FormattedMessage
                    id='user.settings.general.position'
                    defaultMessage='Position'
                />
            </strong>
            <p
                aria-labelledby={titleId}
                className='user-popover__subtitle-text'
            >
                {position}
            </p>
        </div>
    );
};

export default ProfilePopoverPosition;
