// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import moment from 'moment-timezone';

import {getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {generateCurrentTimezoneLabel} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import {
    formatTimezoneOffsetShort,
    getNextMonday9amTimestamp,
    getRecipientLocationLabel,
    getTheirMorningTimestamp,
    getToday9amTimestamp,
    getTomorrow9amTimestamp,
    hasRecipientTimezone,
    isDmScheduleRedesign,
    reinterpretWallClock,
    shouldShowToday9amPreset,
} from './schedule_message_dm_utils';

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getDirectChannel: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: jest.fn(),
    getUser: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/timezone', () => ({
    generateCurrentTimezoneLabel: jest.fn(),
}));

const mockedGetDirectChannel = jest.mocked(getDirectChannel);
const mockedGetCurrentUserId = jest.mocked(getCurrentUserId);
const mockedGetUser = jest.mocked(getUser);
const mockedGenerateCurrentTimezoneLabel = jest.mocked(generateCurrentTimezoneLabel);

describe('schedule_message_dm_utils', () => {
    describe('hasRecipientTimezone', () => {
        it('returns false when timezone is missing', () => {
            expect(hasRecipientTimezone({} as never)).toBe(false);
            expect(hasRecipientTimezone(undefined)).toBe(false);
        });

        it('returns true when timezone is set', () => {
            expect(hasRecipientTimezone({
                timezone: {
                    useAutomaticTimezone: 'true',
                    automaticTimezone: 'America/New_York',
                    manualTimezone: '',
                },
            } as never)).toBe(true);
        });
    });

    describe('getTheirMorningTimestamp', () => {
        const tz = 'America/New_York';

        it('returns today at 9am on weekday before 9am', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 8}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-21 09:00');
        });

        it('returns next weekday at 9am after 9am on weekday', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 10}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-22 09:00');
        });

        it('skips weekend from Friday evening', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 23, hour: 18}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.weekday).toBe(1);
            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-26 09:00');
        });

        it('returns Monday 9am from Saturday', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 24, hour: 12}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-26 09:00');
        });
    });

    describe('reinterpretWallClock', () => {
        it('preserves wall clock values when changing timezone', () => {
            const original = moment.tz('2025-05-22 09:00', 'America/New_York');
            const reinterpreted = reinterpretWallClock(original, 'Europe/London');

            expect(reinterpreted.format('YYYY-MM-DD HH:mm')).toBe('2025-05-22 09:00');
            expect(reinterpreted.tz()).toBe('Europe/London');
        });
    });

    describe('getToday9amTimestamp', () => {
        it('returns today at 9am in the given timezone', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 8}, {zone: 'America/New_York'});
            const result = DateTime.fromMillis(getToday9amTimestamp('America/New_York', now)).setZone('America/New_York');

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-21 09:00');
        });
    });

    describe('shouldShowToday9amPreset', () => {
        const tz = 'America/New_York';

        it('returns true on weekday mornings before 9am', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 8}, {zone: tz});
            expect(shouldShowToday9amPreset(tz, now)).toBe(true);
        });

        it('returns false after 9am on weekdays', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 10}, {zone: tz});
            expect(shouldShowToday9amPreset(tz, now)).toBe(false);
        });

        it('returns false on weekends', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 24, hour: 8}, {zone: tz});
            expect(shouldShowToday9amPreset(tz, now)).toBe(false);
        });
    });

    describe('formatTimezoneOffsetShort', () => {
        it('formats offsets with zero-padded hours and minutes', () => {
            const at = moment.tz('2025-01-15 12:00', 'Europe/London');
            expect(formatTimezoneOffsetShort('Europe/London', at)).toBe('UTC+00:00');
        });
    });

    describe('getTomorrow9amTimestamp', () => {
        it('returns tomorrow at 9am in the given timezone', () => {
            jest.useFakeTimers();
            jest.setSystemTime(DateTime.fromObject({
                year: 2025,
                month: 5,
                day: 21,
                hour: 14,
            }, {zone: 'America/New_York'}).toJSDate());

            const result = DateTime.fromMillis(getTomorrow9amTimestamp('America/New_York')).setZone('America/New_York');

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-22 09:00');
            jest.useRealTimers();
        });
    });

    describe('getNextMonday9amTimestamp', () => {
        it('returns next Monday at 9am in the given timezone', () => {
            jest.useFakeTimers();
            jest.setSystemTime(DateTime.fromObject({
                year: 2025,
                month: 5,
                day: 21,
                hour: 14,
            }, {zone: 'America/New_York'}).toJSDate());

            const result = DateTime.fromMillis(getNextMonday9amTimestamp('America/New_York')).setZone('America/New_York');

            expect(result.weekday).toBe(1);
            expect(result.toFormat('HH:mm')).toBe('09:00');
            jest.useRealTimers();
        });
    });

    describe('getRecipientLocationLabel', () => {
        it('returns teammate position when set', () => {
            expect(getRecipientLocationLabel({
                position: '  San Francisco  ',
            } as never, 'America/Los_Angeles')).toBe('San Francisco');
            expect(mockedGenerateCurrentTimezoneLabel).not.toHaveBeenCalled();
        });

        it('returns timezone label when position is empty', () => {
            mockedGenerateCurrentTimezoneLabel.mockReturnValue('Pacific Time');

            expect(getRecipientLocationLabel({
                position: '   ',
            } as never, 'America/Los_Angeles')).toBe('Pacific Time');
            expect(mockedGenerateCurrentTimezoneLabel).toHaveBeenCalledWith('America/Los_Angeles');
        });
    });

    describe('isDmScheduleRedesign', () => {
        const state = {} as GlobalState;
        const channelId = 'dm_channel_id';

        beforeEach(() => {
            mockedGetCurrentUserId.mockReturnValue('current_user_id');
        });

        it('returns false for non-DM channels', () => {
            mockedGetDirectChannel.mockReturnValue({
                id: channelId,
                type: 'O',
            } as never);

            expect(isDmScheduleRedesign(state, channelId)).toBe(false);
        });

        it('returns false for self-DM', () => {
            mockedGetDirectChannel.mockReturnValue({
                id: channelId,
                teammate_id: 'current_user_id',
                type: 'D',
            } as never);

            expect(isDmScheduleRedesign(state, channelId)).toBe(false);
        });

        it('returns false for bot DMs', () => {
            mockedGetDirectChannel.mockReturnValue({
                id: channelId,
                teammate_id: 'bot_user_id',
                type: 'D',
            } as never);
            mockedGetUser.mockReturnValue({
                id: 'bot_user_id',
                is_bot: true,
                timezone: {
                    useAutomaticTimezone: 'true',
                    automaticTimezone: 'UTC',
                    manualTimezone: '',
                },
            } as never);

            expect(isDmScheduleRedesign(state, channelId)).toBe(false);
        });

        it('returns false when teammate has no timezone', () => {
            mockedGetDirectChannel.mockReturnValue({
                id: channelId,
                teammate_id: 'teammate_user_id',
                type: 'D',
            } as never);
            mockedGetUser.mockReturnValue({
                id: 'teammate_user_id',
                is_bot: false,
            } as never);

            expect(isDmScheduleRedesign(state, channelId)).toBe(false);
        });

        it('returns true for 1:1 DM with known recipient timezone', () => {
            mockedGetDirectChannel.mockReturnValue({
                id: channelId,
                teammate_id: 'teammate_user_id',
                type: 'D',
            } as never);
            mockedGetUser.mockReturnValue({
                id: 'teammate_user_id',
                is_bot: false,
                timezone: {
                    useAutomaticTimezone: 'true',
                    automaticTimezone: 'Europe/London',
                    manualTimezone: '',
                },
            } as never);

            expect(isDmScheduleRedesign(state, channelId)).toBe(true);
        });
    });
});
