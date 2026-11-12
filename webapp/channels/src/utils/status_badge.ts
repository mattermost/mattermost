// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {StatusBadgeStatus} from '@mattermost/compass-ui/components/status-badge';

const statusLabels = defineMessages({
    online: {id: 'mobile.set_status.online.icon', defaultMessage: 'Online'},
    away: {id: 'mobile.set_status.away.icon', defaultMessage: 'Away'},
    dnd: {id: 'mobile.set_status.dnd.icon', defaultMessage: 'Do Not Disturb'},
    offline: {id: 'mobile.set_status.offline.icon', defaultMessage: 'Offline'},
});

/**
 * Maps a Mattermost user status ('online' | 'away' | 'dnd' | 'offline' | anything else) to the
 * Compass StatusBadge status prop. Unknown values render as offline.
 */
export function getStatusBadgeStatus(status: string): StatusBadgeStatus {
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

/**
 * Returns the `status` and translated `label` props for a Compass StatusBadge, or undefined when there is
 * no status to show (e.g. bots), so callers can render the badge conditionally.
 */
export function getStatusBadgeProps(status: string | undefined, formatMessage: IntlShape['formatMessage']) {
    if (!status) {
        return undefined;
    }

    const message = statusLabels[status as keyof typeof statusLabels] ?? statusLabels.offline;
    return {
        status: getStatusBadgeStatus(status),
        label: formatMessage(message),
    };
}
