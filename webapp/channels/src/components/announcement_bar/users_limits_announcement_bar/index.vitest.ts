// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shouldShowCriticalBanner, shouldShowWarningBanner} from './index';
import type {ShouldShowingUserLimitsAnnouncementBarProps} from './index';

describe('shouldShowCriticalBanner', () => {
    const defaultCriticalProps: ShouldShowingUserLimitsAnnouncementBarProps = {
        userIsAdmin: true,
        isLicensed: false,
        maxUsersHardLimit: 20,
        activeUserCount: 15,
    };

    test('should not show when user is not admin', () => {
        const props = {
            ...defaultCriticalProps,
            userIsAdmin: false,
        };
        expect(shouldShowCriticalBanner(props)).toBe(false);
    });

    test('should not show when active users count is 0', () => {
        const props = {
            ...defaultCriticalProps,
            activeUserCount: 0,
        };
        expect(shouldShowCriticalBanner(props)).toBe(false);
    });

    test('should not show when max users hard limit is 0', () => {
        const props = {
            ...defaultCriticalProps,
            maxUsersHardLimit: 0,
        };
        expect(shouldShowCriticalBanner(props)).toBe(false);
    });

    test('should not show when active users count is less than max users hard limit', () => {
        const props = {
            ...defaultCriticalProps,
            activeUserCount: 15,
            maxUsersHardLimit: 20,
        };
        expect(shouldShowCriticalBanner(props)).toBe(false);
    });

    test('should show when active users count is equal to max users hard limit', () => {
        const props = {
            ...defaultCriticalProps,
            activeUserCount: 20,
            maxUsersHardLimit: 20,
        };
        expect(shouldShowCriticalBanner(props)).toBe(true);
    });

    test('should show for non licensed servers with active users count is greater than max users hard limit', () => {
        const props = {
            ...defaultCriticalProps,
            isLicensed: false,
            activeUserCount: 25,
            maxUsersHardLimit: 20,
        };
        expect(shouldShowCriticalBanner(props)).toBe(true);
    });

    test('should not show for licensed server', () => {
        const props = {
            ...defaultCriticalProps,
            isLicensed: true,
            activeUserCount: 0,
            maxUsersHardLimit: 0,
        };

        expect(shouldShowCriticalBanner(props)).toBe(false);
    });

    test('should not show for licensed server even if user count is greater than max users hard limit', () => {
        const props = {
            ...defaultCriticalProps,
            isLicensed: true,
            activeUserCount: 25,
            maxUsersHardLimit: 20,
        };

        expect(shouldShowCriticalBanner(props)).toBe(false);
    });
});

describe('shouldShowWarningBanner', () => {
    const defaultWarningProps: ShouldShowingUserLimitsAnnouncementBarProps = {
        userIsAdmin: true,
        isLicensed: false,
        maxUsersLimit: 10,
        maxUsersHardLimit: 20,
        activeUserCount: 12,
        isWarningDismissed: false,
    };

    test('should not show when user is not admin', () => {
        const props = {
            ...defaultWarningProps,
            userIsAdmin: false,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should not show when active users count is 0', () => {
        const props = {
            ...defaultWarningProps,
            activeUserCount: 0,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should not show when max users limit is 0', () => {
        const props = {
            ...defaultWarningProps,
            maxUsersLimit: 0,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should not show when max users hard limit is 0', () => {
        const props = {
            ...defaultWarningProps,
            maxUsersHardLimit: 0,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should not show when warning is dismissed', () => {
        const props = {
            ...defaultWarningProps,
            isWarningDismissed: true,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should not show when active users count is less than max users limit', () => {
        const props = {
            ...defaultWarningProps,
            activeUserCount: 8,
            maxUsersLimit: 10,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should not show when active users count is greater than or equal to max users hard limit', () => {
        const props = {
            ...defaultWarningProps,
            activeUserCount: 20,
            maxUsersHardLimit: 20,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });

    test('should show when active users count is between max users limit and max users hard limit', () => {
        const props = {
            ...defaultWarningProps,
            activeUserCount: 15,
            maxUsersLimit: 10,
            maxUsersHardLimit: 20,
        };
        expect(shouldShowWarningBanner(props)).toBe(true);
    });

    test('should show when active users count equals max users limit', () => {
        const props = {
            ...defaultWarningProps,
            activeUserCount: 10,
            maxUsersLimit: 10,
            maxUsersHardLimit: 20,
        };
        expect(shouldShowWarningBanner(props)).toBe(true);
    });

    test('should not show for licensed server', () => {
        const props = {
            ...defaultWarningProps,
            isLicensed: true,
        };
        expect(shouldShowWarningBanner(props)).toBe(false);
    });
});
