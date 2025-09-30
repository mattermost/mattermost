// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {General} from 'mattermost-redux/constants';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {Preferences} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import type {GlobalState} from 'types/store';

import PostHistoryLimitBanner from './index';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(),
}));

jest.mock('components/common/hooks/useGetServerLimits', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/common/hooks/useOpenPricingModal', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockUseGetServerLimits = require('components/common/hooks/useGetServerLimits').default;
const mockUseOpenPricingModal = require('components/common/hooks/useOpenPricingModal').default;
const mockSavePreferences = savePreferences as jest.MockedFunction<typeof savePreferences>;

const email = 'test@mattermost.com';
const licenseId = generateId();
const currentUserId = 'current_user';
const postHistoryLimit = 10000;
const lastAccessiblePostTime = new Date('2021-12-31T12:00:00.000Z').getTime();

const bannerText = `${postHistoryLimit.toLocaleString()}-message limit reached. Messages sent before December 31, 2021 are hidden`;

describe('components/announcement_bar/PostHistoryLimitBanner', () => {
    let mockOpenPricingModal: jest.Mock;
    let mockDispatch: jest.Mock;
    let mockToLocaleDateString: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        mockOpenPricingModal = jest.fn();
        mockUseOpenPricingModal.mockReturnValue({openPricingModal: mockOpenPricingModal});

        mockDispatch = jest.fn();
        require('react-redux').useDispatch.mockReturnValue(mockDispatch);

        // Set up a default mock for toLocaleDateString that returns "December 31, 2021"
        // This matches our global lastAccessiblePostTime variable
        mockToLocaleDateString = jest.spyOn(Date.prototype, 'toLocaleDateString').
            mockReturnValue('December 31, 2021');
    });

    afterEach(() => {
        if (mockToLocaleDateString) {
            mockToLocaleDateString.mockRestore();
        }
    });

    const createInitialState = (
        isAdmin = true,
        preferences: Array<{category: string; name: string; value: string}> = [],
        locale = 'en-US',
    ): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {
                        roles: isAdmin ? General.SYSTEM_ADMIN_ROLE : General.SYSTEM_USER_ROLE,
                        id: currentUserId,
                        email,
                        locale,
                    },
                },
            },
            general: {
                license: {
                    IsLicensed: 'true',
                    Id: licenseId,
                },
            },
            preferences: {
                myPreferences: TestHelper.getPreferencesMock(preferences, currentUserId),
            },
        },
    });

    const setupServerLimits = (hasLimits = true, loaded = true) => {
        const serverLimits = hasLimits ? {
            postHistoryLimit,
            lastAccessiblePostTime,
            activeUserCount: 50,
            maxUsersLimit: 100,
            maxUsersHardLimit: 120,
        } : {
            postHistoryLimit: 0,
            lastAccessiblePostTime: 0,
            activeUserCount: 50,
            maxUsersLimit: 100,
            maxUsersHardLimit: 120,
        };

        mockUseGetServerLimits.mockReturnValue([serverLimits, loaded]);
    };

    describe('Banner Display Logic', () => {
        it('should show banner when posts are truncated and never dismissed', () => {
            setupServerLimits(true);
            const state = createInitialState(true, []);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(bannerText)).toBeInTheDocument();
            expect(screen.getByText('Restore Access')).toBeInTheDocument();
        });

        it('should not show banner when limits are not loaded', () => {
            setupServerLimits(true, false);
            const state = createInitialState(true, []);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });

        it('should not show banner when posts are not truncated', () => {
            setupServerLimits(false);
            const state = createInitialState(true, []);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });

        it('should not show banner when lastAccessiblePostTime is 0', () => {
            mockUseGetServerLimits.mockReturnValue([{
                postHistoryLimit,
                lastAccessiblePostTime: 0,
                activeUserCount: 50,
                maxUsersLimit: 100,
                maxUsersHardLimit: 120,
            }, true]);

            const state = createInitialState(true, []);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });
    });

    describe('Time-Based Dismissal Logic', () => {
        const preferenceName = 'post_history_limit_banner';

        it('should not show banner when recently dismissed by admin (< 7 days)', () => {
            setupServerLimits(true);

            const recentDismissalTime = Date.now() - (6 * 24 * 60 * 60 * 1000); // 6 days ago
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: recentDismissalTime.toString(),
            }];

            const state = createInitialState(true, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });

        it('should show banner when dismissed by admin > 7 days ago', () => {
            setupServerLimits(true);

            const oldDismissalTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: oldDismissalTime.toString(),
            }];

            const state = createInitialState(true, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });

        it('should not show banner when recently dismissed by regular user (< 30 days)', () => {
            setupServerLimits(true);

            const recentDismissalTime = Date.now() - (29 * 24 * 60 * 60 * 1000); // 29 days ago
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: recentDismissalTime.toString(),
            }];

            const state = createInitialState(false, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });

        it('should show banner when dismissed by regular user > 30 days ago', () => {
            setupServerLimits(true);

            const oldDismissalTime = Date.now() - (31 * 24 * 60 * 60 * 1000); // 31 days ago
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: oldDismissalTime.toString(),
            }];

            const state = createInitialState(false, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });

        it('should not show banner when dismissed and posts are no longer truncated', () => {
            setupServerLimits(false); // No limits

            const oldDismissalTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: oldDismissalTime.toString(),
            }];

            const state = createInitialState(true, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });
    });

    describe('User Interactions', () => {
        const preferenceName = 'post_history_limit_banner';

        it('should call openPricingModal when upgrade button is clicked', () => {
            setupServerLimits(true);
            const state = createInitialState(true, []);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            const upgradeButton = screen.getByText('Restore Access');
            fireEvent.click(upgradeButton);

            expect(mockOpenPricingModal).toHaveBeenCalled();
        });

        it('should save dismissal timestamp when close button is clicked', () => {
            setupServerLimits(true);
            const state = createInitialState(true, []);

            const mockDateNow = 1234567890;
            jest.spyOn(Date, 'now').mockReturnValue(mockDateNow);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            const closeButton = screen.getByRole('link', {name: '×'});
            fireEvent.click(closeButton);

            expect(mockDispatch).toHaveBeenCalledWith(
                mockSavePreferences(currentUserId, [{
                    category: Preferences.POST_HISTORY_LIMIT_BANNER,
                    name: preferenceName,
                    user_id: currentUserId,
                    value: mockDateNow.toString(),
                }]),
            );

            (Date.now as jest.Mock).mockRestore();
        });
    });

    describe('Date Formatting', () => {
        it('should format date correctly for recent dates', () => {
            const recentDate = new Date('2023-07-15T12:00:00.000Z').getTime();
            const locale = 'en-US';

            // Override the global mock for this specific test
            mockToLocaleDateString.mockReturnValue('July 15, 2023');

            mockUseGetServerLimits.mockReturnValue([{
                postHistoryLimit: 5000,
                lastAccessiblePostTime: recentDate,
                activeUserCount: 50,
                maxUsersLimit: 100,
                maxUsersHardLimit: 120,
            }, true]);

            const state = createInitialState(true, [], locale);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(/July 15, 2023/)).toBeInTheDocument();
            expect(mockToLocaleDateString).toHaveBeenCalledWith(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        });

        it('should format date correctly for older dates with year', () => {
            const oldDate = new Date('2021-12-01T12:00:00.000Z').getTime();
            const locale = 'en-US';

            // Override the global mock for this specific test
            mockToLocaleDateString.mockReturnValue('December 1, 2021');

            mockUseGetServerLimits.mockReturnValue([{
                postHistoryLimit: 8000,
                lastAccessiblePostTime: oldDate,
                activeUserCount: 50,
                maxUsersLimit: 100,
                maxUsersHardLimit: 120,
            }, true]);

            const state = createInitialState(true, [], locale);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(/December 1, 2021/)).toBeInTheDocument();
            expect(mockToLocaleDateString).toHaveBeenCalledWith(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        });
    });

    describe('Admin vs Regular User Behavior', () => {
        it('should use 7-day threshold for admins', () => {
            setupServerLimits(true);

            const dismissalTime = Date.now() - (7.5 * 24 * 60 * 60 * 1000); // 7.5 days ago
            const preferenceName = 'post_history_limit_banner';
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: dismissalTime.toString(),
            }];

            const state = createInitialState(true, preferences); // Admin

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });

        it('should use 30-day threshold for regular users', () => {
            setupServerLimits(true);

            const dismissalTime = Date.now() - (7.5 * 24 * 60 * 60 * 1000); // 7.5 days ago
            const preferenceName = 'post_history_limit_banner';
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: dismissalTime.toString(),
            }];

            const state = createInitialState(false, preferences); // Regular user

            renderWithContext(<PostHistoryLimitBanner/>, state);

            // Should not show because regular users need 30 days
            expect(screen.queryByText(bannerText)).not.toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle invalid dismissal timestamp gracefully', () => {
            setupServerLimits(true);

            const preferenceName = 'post_history_limit_banner';
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: 'invalid-timestamp',
            }];

            const state = createInitialState(true, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            // Should show banner because invalid timestamp is treated as 0
            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });

        it('should handle missing license ID gracefully', () => {
            setupServerLimits(true);

            const stateWithoutLicense = createInitialState(true, []);
            stateWithoutLicense.entities!.general!.license = {};

            renderWithContext(<PostHistoryLimitBanner/>, stateWithoutLicense);

            // Should still render because preference name will use empty string prefix
            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });

        it('should show banner when preference exists but has no value', () => {
            setupServerLimits(true);

            const preferenceName = 'post_history_limit_banner';
            const preferences = [{
                category: Preferences.POST_HISTORY_LIMIT_BANNER,
                name: preferenceName,
                value: '',
            }];

            const state = createInitialState(true, preferences);

            renderWithContext(<PostHistoryLimitBanner/>, state);

            expect(screen.getByText(bannerText)).toBeInTheDocument();
        });
    });
});
