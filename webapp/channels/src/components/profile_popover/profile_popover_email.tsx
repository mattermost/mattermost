// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    email?: string;
    haveOverrideProp?: boolean;
    isBot?: boolean;
    userId: string;
}
const ProfilePopoverEmail = ({
    email,
    haveOverrideProp,
    isBot,
    userId,
}: Props) => {
    if (!email || isBot || haveOverrideProp) {
        return null;
    }

    // Generate a unique ID for accessibility
    const titleId = `user-popover__custom_attributes-title-${userId}`;

    return (
        <div className='user-popover__custom_attributes'>
            <strong
                id={titleId}
                className='user-popover__subtitle'
            >
                <FormattedMessage
                    id='general_tab.emailAddress'
                    defaultMessage='Email Address'
                />
            </strong>
            <p
                aria-labelledby={titleId}
                className='user-popover__subtitle-text'
            >
                <a
                    href={`mailto:${email}`}
                >
                    {email}
                </a>
            </p>
        </div>
    );
};

export default ProfilePopoverEmail;
