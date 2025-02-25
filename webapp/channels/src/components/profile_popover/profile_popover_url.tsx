// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    url?: string;
}
const ProfilePopoverUrl = ({url}: Props) => {
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
