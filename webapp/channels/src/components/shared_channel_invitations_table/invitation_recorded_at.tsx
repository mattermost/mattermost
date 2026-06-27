// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export function InvitationRecordedAt({createAt}: {createAt: number}) {
    const intl = useIntl();
    const date = new Date(createAt);
    const text = intl.formatMessage(
        {
            id: 'admin.secure_connections.shared_channels.invitations.recorded_at',
            defaultMessage: '{date} {time}',
        },
        {
            date: intl.formatDate(date, {year: 'numeric', month: 'short', day: '2-digit'}),
            time: intl.formatTime(date),
        },
    );
    return <span>{text}</span>;
}
