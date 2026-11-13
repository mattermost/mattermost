// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import {defineMessages} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {StatusBadgeSize, StatusBadgeStatus} from '@mattermost/compass-ui/components/status-badge';

import type {TAvatarSizeToken} from 'components/widgets/users/avatar';

const statusLabels = defineMessages({
    online: {id: 'mobile.set_status.online.icon', defaultMessage: 'Online'},
    away: {id: 'mobile.set_status.away.icon', defaultMessage: 'Away'},
    dnd: {id: 'mobile.set_status.dnd.icon', defaultMessage: 'Do Not Disturb'},
    offline: {id: 'mobile.set_status.offline.icon', defaultMessage: 'Offline'},
});

/**
 * Avatar sizes a StatusBadge can be placed on: the Mattermost avatar size tokens plus the 120px profile popover
 * avatar, which has no token of its own.
 */
export type StatusBadgeAvatarSize = TAvatarSizeToken | '120';

/**
 * Badge size and corner offset for each avatar size, mirroring compass-ui UserAvatar (avatar px -> StatusBadge
 * size, and its right/bottom offset). `offset` is the CSS right/bottom value in px, so negative values sit outside
 * the avatar's corner and positive values inset the badge:
 *   12-16px -> xx-small, 20-28px -> x-small (offset -1)
 *   32-50px -> small (offset -2)
 *   56-80px -> medium, drawn at 20px (offset 0; 1 at 80px)
 *   96px -> large (offset 0), 120px -> large (offset 3), 128px -> x-large (offset 2)
 */
const avatarBadgePlacement: Record<StatusBadgeAvatarSize, {size: StatusBadgeSize; offset: -2 | -1 | 0 | 2 | 3}> = {
    xxs: {size: 'xx-small', offset: -1}, // 16px
    xs: {size: 'x-small', offset: -1}, // 20px
    sm: {size: 'x-small', offset: -1}, // 24px
    md: {size: 'small', offset: -2}, // 32px
    lg: {size: 'small', offset: -2}, // 36px
    xl: {size: 'small', offset: -2}, // 50px
    'xl-custom-GM': {size: 'medium', offset: 0}, // 72px
    'xl-custom-DM': {size: 'large', offset: 0}, // 96px
    120: {size: 'large', offset: 3}, // 120px (profile popover)
    xxl: {size: 'x-large', offset: 2}, // 128px
    inherit: {size: 'small', offset: -2}, // compact posts: one size up from the default for readability
};

/**
 * Class names that place a StatusBadge on the corner of an avatar of the given size. Use inside a
 * `.status-wrapper` that wraps the avatar. See `.user-status-badge` in sass/components/_status-icon.scss.
 */
export function getStatusBadgeClassName(avatarSize: StatusBadgeAvatarSize = 'inherit', extraClassName?: string): string {
    const {size, offset} = avatarBadgePlacement[avatarSize];
    return classNames(
        'user-status-badge',
        `user-status-badge--offset-${offset < 0 ? `n${-offset}` : offset}`,
        {'user-status-badge--medium': size === 'medium'},
        extraClassName,
    );
}

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
 * Returns the `status`, `size` and translated `label` props for a Compass StatusBadge shown on an avatar of
 * the given size, or undefined when there is no status to show (e.g. bots), so callers can render the badge
 * conditionally.
 */
export function getStatusBadgeProps(status: string | undefined, formatMessage: IntlShape['formatMessage'], avatarSize: StatusBadgeAvatarSize = 'inherit') {
    if (!status) {
        return undefined;
    }

    const message = statusLabels[status as keyof typeof statusLabels] ?? statusLabels.offline;
    return {
        status: getStatusBadgeStatus(status),
        size: avatarBadgePlacement[avatarSize].size,
        label: formatMessage(message),
    };
}
