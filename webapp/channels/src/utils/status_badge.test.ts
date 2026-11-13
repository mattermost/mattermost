// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import {getStatusBadgeClassName, getStatusBadgeProps, getStatusBadgeStatus} from 'utils/status_badge';

describe('utils/status_badge', () => {
    const formatMessage = ((descriptor: {defaultMessage: string}) => descriptor.defaultMessage) as unknown as IntlShape['formatMessage'];

    describe('getStatusBadgeStatus', () => {
        test.each([
            ['online', 'online'],
            ['away', 'away'],
            ['dnd', 'do-not-disturb'],
            ['offline', 'offline'],
            ['something-else', 'offline'],
            ['', 'offline'],
        ])('maps %p to %p', (status, expected) => {
            expect(getStatusBadgeStatus(status)).toBe(expected);
        });
    });

    describe('getStatusBadgeProps', () => {
        test.each([undefined, ''])('returns undefined when there is no status (%p)', (status) => {
            expect(getStatusBadgeProps(status, formatMessage)).toBeUndefined();
        });

        test.each([
            ['online', 'online', 'Online'],
            ['away', 'away', 'Away'],
            ['dnd', 'do-not-disturb', 'Do Not Disturb'],
            ['offline', 'offline', 'Offline'],
        ])('returns the badge status and translated label for %p', (status, badgeStatus, label) => {
            expect(getStatusBadgeProps(status, formatMessage, 'md')).toEqual({status: badgeStatus, size: 'small', label});
        });

        test('treats an unknown status as offline', () => {
            expect(getStatusBadgeProps('unknown', formatMessage)).toEqual({status: 'offline', size: 'small', label: 'Offline'});
        });

        test.each([
            ['xxs', 'xx-small'],
            ['xs', 'x-small'],
            ['sm', 'x-small'],
            ['md', 'small'],
            ['lg', 'small'],
            ['xl', 'small'],
            ['xl-custom-GM', 'medium'],
            ['xl-custom-DM', 'large'],
            ['120', 'large'],
            ['xxl', 'x-large'],
            ['inherit', 'small'],
        ] as const)('sizes the badge for a %p avatar as %p', (avatarSize, badgeSize) => {
            expect(getStatusBadgeProps('online', formatMessage, avatarSize)?.size).toBe(badgeSize);
        });
    });

    describe('getStatusBadgeClassName', () => {
        test.each([
            ['xs', 'user-status-badge user-status-badge--offset-n1'],
            ['sm', 'user-status-badge user-status-badge--offset-n1'],
            ['md', 'user-status-badge user-status-badge--offset-n2'],
            ['xl-custom-GM', 'user-status-badge user-status-badge--offset-0 user-status-badge--medium'],
            ['xl-custom-DM', 'user-status-badge user-status-badge--offset-0'],
            ['120', 'user-status-badge user-status-badge--offset-3'],
            ['xxl', 'user-status-badge user-status-badge--offset-2'],
        ] as const)('uses the corner offset for a %p avatar', (avatarSize, expected) => {
            expect(getStatusBadgeClassName(avatarSize)).toBe(expected);
        });

        test('appends an extra class name', () => {
            expect(getStatusBadgeClassName('md', 'extra')).toBe('user-status-badge user-status-badge--offset-n2 extra');
        });
    });
});
