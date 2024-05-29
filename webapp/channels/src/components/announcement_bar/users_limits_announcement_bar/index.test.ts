// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shouldShowUserLimitsAnnouncementBar} from './index';
import type {ShouldShowingUserLimitsAnnouncementBarProps} from './index';

describe('shouldShowUserLimitsAnnouncementBar', () => {
    const defaultProps: ShouldShowingUserLimitsAnnouncementBarProps = {
        userIsAdmin: true,
        isLicensed: false,
        maxUsersLimit: 10,
        activeUserCount: 5,
    };

    test('should not show when user is not admin', () => {
        const props = {
            ...defaultProps,
            userIsAdmin: false,
        };
        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show when active users count is 0', () => {
        const props = {
            ...defaultProps,
            activeUserCount: 0,
        };
        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show when max users limit is 0', () => {
        const props = {
            ...defaultProps,
            maxUsersLimit: 0,
        };
        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show when active users count is less than max users limit', () => {
        const props = {
            ...defaultProps,
            activeUserCount: 5,
            maxUsersLimit: 10,
        };
        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should show when active users count is equal to max users limit', () => {
        const props = {
            ...defaultProps,
            activeUserCount: 10,
            maxUsersLimit: 10,
        };
        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(true);
    });

    test('should show for non licensed servers with active users count is greater than max users limit', () => {
        const props = {
            ...defaultProps,
            isLicensed: false,
            activeUserCount: 15,
            maxUsersLimit: 10,
        };
        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(true);
    });

    test('should not show for licensed server', () => {
        const props = {
            ...defaultProps,
            isLicensed: true,
            activeUserCount: 0,
            maxUsersLimit: 0,
        };

        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show for licensed server even if user count is greater than max users limit', () => {
        const props = {
            ...defaultProps,
            isLicensed: true,
            activeUserCount: 101,
            maxUsersLimit: 100,
        };

        expect(shouldShowUserLimitsAnnouncementBar(props)).toBe(false);
    });
});
