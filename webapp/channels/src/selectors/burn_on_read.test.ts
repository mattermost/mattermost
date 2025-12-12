// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import TestHelper from 'packages/mattermost-redux/test/test_helper';

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
        it('should return true when config.EnableBurnOnRead is true', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(true);
        });

        it('should return false when config.EnableBurnOnRead is false', () => {
            state.entities.general.config.EnableBurnOnRead = 'false';
            const result = isBurnOnReadEnabled(state);
            expect(result).toBe(false);
        });

        it('should return false when config.EnableBurnOnRead is not set', () => {
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
        it('should return true when feature is enabled', () => {
            state.entities.general.config.EnableBurnOnRead = 'true';
            const result = canUserSendBurnOnRead(state);
            expect(result).toBe(true);
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
