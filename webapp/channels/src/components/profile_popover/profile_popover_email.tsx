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

    function handleEmailClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        window.open(`mailto:${email}`);
    }

    // Generate a unique ID for accessibility
    const titleId = `user-popover__custom_attributes-title-${userId}`;

    return (
        <div
            title={email}
            className='user-profile-popover__email'
        >
            <strong
                id={titleId}
                className='user-popover__subtitle'
            >
                <FormattedMessage
                    id='user.settings.general.email'
                    defaultMessage='Email'
                />
            </strong>
            <p
                aria-labelledby={titleId}
                className='user-popover__subtitle-text'
            >
                <a
                    href={`mailto:${email}`}
                    onClick={handleEmailClick}
                >
                    {email}
                </a>
            </p>
        </div>
    );
};

export default ProfilePopoverEmail;
