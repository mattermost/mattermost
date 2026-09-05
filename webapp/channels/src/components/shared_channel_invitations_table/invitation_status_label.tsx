// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import Tag from 'components/widgets/tag/tag';

export function InvitationStatusLabel({status}: {status: SharedChannelInvitation['status']}) {
    const {formatMessage} = useIntl();

    switch (status) {
    case 'pending':
        return (
            <Tag
                size='sm'
                text={formatMessage({
                    id: 'admin.secure_connections.shared_channels.invitations.status.pending',
                    defaultMessage: 'Pending',
                })}
            />
        );
    case 'failed':
        return (
            <Tag
                size='sm'
                variant='dangerDim'
                icon='alert-outline'
                text={formatMessage({
                    id: 'admin.secure_connections.shared_channels.invitations.status.failed',
                    defaultMessage: 'Failed',
                })}
            />
        );
    default:
        return (
            <Tag
                size='sm'
                text={formatMessage(
                    {
                        id: 'admin.secure_connections.shared_channels.invitations.status.unknown',
                        defaultMessage: 'Unknown status ({status})',
                    },
                    {status: String(status)},
                )}
            />
        );
    }
}
