// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StatusBadge} from '@mattermost/compass-ui/components/status-badge';
import type {StatusBadgeStatus} from '@mattermost/compass-ui/components/status-badge';
import React, {memo} from 'react';
import {useIntl} from 'react-intl';

type Props = {
    id?: string;
    button?: boolean;
    status?: string;
    className?: string;
};

function mapUserStatusToBadgeStatus(status: string): StatusBadgeStatus {
    switch (status) {
    case 'online':
    case 'away':
        return status;
    case 'dnd':
        return 'do-not-disturb';
    default:
        return 'offline';
    }
}

function getStatusAriaLabel(status: string, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    switch (status) {
    case 'online':
        return formatMessage({id: 'mobile.set_status.online.icon', defaultMessage: 'Online'});
    case 'away':
        return formatMessage({id: 'mobile.set_status.away.icon', defaultMessage: 'Away'});
    case 'dnd':
        return formatMessage({id: 'mobile.set_status.dnd.icon', defaultMessage: 'Do Not Disturb'});
    default:
        return formatMessage({id: 'mobile.set_status.offline.icon', defaultMessage: 'Offline'});
    }
}

const StatusIcon = ({
    id,
    className = '',
    button = false,
    status,
}: Props) => {
    const {formatMessage} = useIntl();

    if (!status) {
        return null;
    }

    const wrapperClassName = button ? (className || '') : `status ${className}`.trim();
    const badgeStatus = mapUserStatusToBadgeStatus(status);
    const ariaLabel = getStatusAriaLabel(status, formatMessage);

    return (
        <span
            id={id}
            className={wrapperClassName}
            role='img'
            aria-label={ariaLabel}
        >
            <span aria-hidden={true}>
                <StatusBadge status={badgeStatus}/>
            </span>
        </span>
    );
};

export default memo(StatusIcon);
