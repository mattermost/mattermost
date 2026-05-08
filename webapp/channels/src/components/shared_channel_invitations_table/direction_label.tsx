// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

export function DirectionLabel({direction}: {direction: SharedChannelInvitation['direction']}) {
    if (direction === 'sent') {
        return (
            <FormattedMessage
                id='admin.secure_connections.shared_channels.invitations.direction.sent'
                defaultMessage='Sent'
            />
        );
    }
    return (
        <FormattedMessage
            id='admin.secure_connections.shared_channels.invitations.direction.received'
            defaultMessage='Received'
        />
    );
}
