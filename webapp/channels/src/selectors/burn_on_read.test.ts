// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {LicenseSkus} from 'utils/constants';
import {TestHelper as WebappTestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {
    isBurnOnReadEnabled,
    getBurnOnReadDurationMinutes,
    canUserSendBurnOnRead,
    hasSeenBurnOnReadTourTip,
    BURN_ON_READ_TOUR_TIP_PREFERENCE,
} from './burn_on_read';

describe('selectors/burn_on_read', () => {
    let state: GlobalState;
    let user: ReturnType<typeof TestHelper.fakeUserWithId>;

    beforeEach(() => {
        user = TestHelper.fakeUserWithId();

        state = {
            entities: {
                general: {
                    config: {},
                    license: WebappTestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: LicenseSkus.EnterpriseAdvanced,
                    }),
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: user.id,
                    profiles: {
                        [user.id]: user,
                    },
                },
            },
        } as unknown as GlobalState;
    });

    describe('isBurnOnReadEnabled', () => {
        it('should return true when config is enabled AND license is Enterprise Advanced', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.EnterpriseAdvanced,
            });
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(true);
        });

        it('should return true when config is enabled AND license is Entry (legacy tier)', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.Entry,
            });
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(true);
        });

        it('should return false when config is enabled but license is Enterprise (not Advanced)', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.Enterprise,
            });
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(false);
        });

        it('should return false when config is enabled but license is Professional', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.Professional,
            });
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(false);
        });

        it('should return false when license is Enterprise Advanced but config is disabled', () => {
            state.entities.general.config.EnableBurnOnRead = 'false';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.EnterpriseAdvanced,
            });
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(false);
        });

        it('should return false when config.EnableBurnOnRead is not set', () => {
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(false);
        });

        it('should return false when no license exists', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = {} as any;
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(false);
        });
    });

    describe('getBurnOnReadDurationMinutes', () => {
        it('should return default 10 minutes when not configured', () => {
            const result = getBurnOnReadDurationMinutes(state);
            expect(result).toBe(10);
        });

        it('should convert configured duration from seconds to minutes', () => {
            state.entities.general.config.BurnOnReadDurationSeconds = '900'; // 15 minutes
            const result = getBurnOnReadDurationMinutes(state);
            expect(result).toBe(15);
        });

        it('should parse different duration values', () => {
            state.entities.general.config.BurnOnReadDurationSeconds = '1800'; // 30 minutes
            const result = getBurnOnReadDurationMinutes(state);
            expect(result).toBe(30);
        });

        it('should handle 1 minute (60 seconds)', () => {
            state.entities.general.config.BurnOnReadDurationSeconds = '60';
            const result = getBurnOnReadDurationMinutes(state);
            expect(result).toBe(1);
        });

        it('should handle 5 minutes (300 seconds)', () => {
            state.entities.general.config.BurnOnReadDurationSeconds = '300';
            const result = getBurnOnReadDurationMinutes(state);
            expect(result).toBe(5);
        });
    });

    describe('canUserSendBurnOnRead', () => {
        it('should return true when feature is enabled and license is Enterprise Advanced', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.EnterpriseAdvanced,
            });
            const result = canUserSendBurnOnRead(state);
            expect(result).toBe(true);
        });

        it('should return false when feature is enabled but license is insufficient', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            state.entities.general.license = WebappTestHelper.getLicenseMock({
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.Professional,
            });
            const result = canUserSendBurnOnRead(state);
            expect(result).toBe(false);
        });

        it('should return false when feature is disabled', () => {
            state.entities.general.config.EnableBurnOnRead = 'false';
            const result = canUserSendBurnOnRead(state);
            expect(result).toBe(false);
        });

        it('should return false when feature is not configured', () => {
            const result = canUserSendBurnOnRead(state);
            expect(result).toBe(false);
        });
    });

    describe('hasSeenBurnOnReadTourTip', () => {
        it('should return false when user has not seen tour tip', () => {
            const result = hasSeenBurnOnReadTourTip(state);
            expect(result).toBe(false);
        });

        it('should return true when user has seen tour tip', () => {
            const pref = {
                category: BURN_ON_READ_TOUR_TIP_PREFERENCE,
                name: user.id,
                user_id: user.id,
                value: '1',
            };

            state.entities.preferences.myPreferences = {
                [getPreferenceKey(BURN_ON_READ_TOUR_TIP_PREFERENCE, user.id)]: pref,
            };

            const result = hasSeenBurnOnReadTourTip(state);
            expect(result).toBe(true);
        });

        it('should return false when preference value is 0', () => {
            const pref = {
                category: BURN_ON_READ_TOUR_TIP_PREFERENCE,
                name: user.id,
                user_id: user.id,
                value: '0',
            };

            state.entities.preferences.myPreferences = {
                [getPreferenceKey(BURN_ON_READ_TOUR_TIP_PREFERENCE, user.id)]: pref,
            };

            const result = hasSeenBurnOnReadTourTip(state);
            expect(result).toBe(false);
        });
    });
});
