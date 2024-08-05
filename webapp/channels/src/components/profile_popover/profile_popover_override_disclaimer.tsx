// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    username: string;
    haveOverrideProp: boolean;
}
const ProfilePopoverOverrideDisclaimer = ({
    username,
    haveOverrideProp,
}: Props) => {
    const {formatMessage} = useIntl();

    if (!haveOverrideProp) {
        return null;
    }

    return (
        <p
            className='user-popover__bottom-row-container'
        >
            {formatMessage({
                id: 'user_profile.account.post_was_created',
                defaultMessage: 'This post was created by an integration from @{username}',
            },
            {
                username,
            })}
        </p>
    );
};

export default ProfilePopoverOverrideDisclaimer;
