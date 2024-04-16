// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    ShouldShowingPostLimitsAnnouncementBarProps} from 'components/announcement_bar/post_limits_announcement_bar/index';
import {shouldShowPostLimitsAnnouncementBar,
} from 'components/announcement_bar/post_limits_announcement_bar/index';

describe('shouldShowPostLimitsAnnouncementBar', () => {
    const defaultProps: ShouldShowingPostLimitsAnnouncementBarProps = {
        userIsAdmin: true,
        isLicensed: false,
        maxPostLimit: 10,
        postCount: 5,
    };

    test('should not show when user is not admin', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            userIsAdmin: false,
        };
        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show when post count is 0', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            postCount: 0,
        };
        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show when max post limit is 0', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            maxPostLimit: 0,
        };
        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show when post count is less than max users limit', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            maxPostLimit: 10,
            postCount: 5,
        };
        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should show when post count is equal to max post limit', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            maxPostLimit: 10,
            postCount: 10,
        };
        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(true);
    });

    test('should show for non licensed servers with post count is greater than max post limit', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            isLicensed: false,
            maxPostLimit: 5,
            postCount: 10,
        };
        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(true);
    });

    test('should not show for licensed server', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            isLicensed: true,
            maxPostLimit: 0,
            postCount: 0,
        };

        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(false);
    });

    test('should not show for licensed server even if post count is greater than max post limit', () => {
        const props: ShouldShowingPostLimitsAnnouncementBarProps = {
            ...defaultProps,
            isLicensed: true,
            maxPostLimit: 10,
            postCount: 11,
        };

        expect(shouldShowPostLimitsAnnouncementBar(props)).toBe(false);
    });
});
