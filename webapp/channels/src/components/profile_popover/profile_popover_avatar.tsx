// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {StatusBadge} from '@mattermost/compass-ui/components/status-badge';

import Avatar from 'components/widgets/users/avatar';

import {getStatusBadgeProps} from 'utils/status_badge';

type Props = {
    username?: string;
    hideStatus?: boolean;
    status?: string;
    urlSrc: string;
};
const ProfilePopoverAvatar = ({
    username,
    hideStatus,
    status,
    urlSrc,
}: Props) => {
    const {formatMessage} = useIntl();
    const statusBadgeProps = getStatusBadgeProps(hideStatus ? undefined : status, formatMessage);

    return (
        <div className='user-popover-image'>
            <Avatar
                id='userAvatar'
                size='xxl'
                username={username}
                url={urlSrc}
                tabIndex={-1}
            />
            {statusBadgeProps && (
                <StatusBadge
                    className='status user-popover-status'
                    {...statusBadgeProps}
                />
            )}
        </div>
    );
};

export default ProfilePopoverAvatar;
