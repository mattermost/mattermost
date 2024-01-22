// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    username: string;
    haveOverrideProp: boolean;
}
const ProfilePopoverOverrideDisclaimer = ({
    username,
    haveOverrideProp,
}: Props) => {
    if (!haveOverrideProp) {
        return null;
    }

    return (
        <div
            data-toggle='tooltip'
            className='popover__row first'
        >
            <FormattedMessage
                id='user_profile.account.post_was_created'
                defaultMessage='This post was created by an integration from @{username}'
                values={{
                    username,
                }}
            />
        </div>
    );
};

export default ProfilePopoverOverrideDisclaimer;
