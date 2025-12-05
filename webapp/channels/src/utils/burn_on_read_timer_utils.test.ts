// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    formatTimeRemaining,
    calculateRemainingTime,
    isTimerInWarningState,
    isTimerExpired,
    getAriaAnnouncementInterval,
    formatAriaAnnouncement,
} from './burn_on_read_timer_utils';

describe('burn_on_read_timer_utils', () => {
    describe('formatTimeRemaining', () => {
        it('should format 10 minutes correctly', () => {
            expect(formatTimeRemaining(600000)).toBe('10:00');
        });

        it('should format 1.5 minutes correctly', () => {
            expect(formatTimeRemaining(90000)).toBe('01:30');
        });

        it('should format 5 seconds correctly', () => {
            expect(formatTimeRemaining(5000)).toBe('00:05');
        });

        it('should format 0 ms as 00:00', () => {
            expect(formatTimeRemaining(0)).toBe('00:00');
        });

        it('should handle negative values as 00:00', () => {
            expect(formatTimeRemaining(-5000)).toBe('00:00');
        });

        it('should round up partial seconds', () => {
            expect(formatTimeRemaining(5500)).toBe('00:06');
        });

        it('should format 59 seconds correctly', () => {
            expect(formatTimeRemaining(59000)).toBe('00:59');
        });

        it('should format exactly 1 minute correctly', () => {
            expect(formatTimeRemaining(60000)).toBe('01:00');
        });
    });

    describe('calculateRemainingTime', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should calculate remaining time correctly with milliseconds', () => {
            const expireAt = new Date('2025-01-01T00:10:00.000Z').getTime();
            expect(calculateRemainingTime(expireAt)).toBe(600000); // 10 minutes
        });

        it('should handle seconds timestamps by converting to milliseconds', () => {
            const expireAtSeconds = Math.floor(new Date('2025-01-01T00:10:00.000Z').getTime() / 1000);
            expect(calculateRemainingTime(expireAtSeconds)).toBe(600000); // 10 minutes
        });

        it('should return negative for expired times', () => {
            const expireAt = new Date('2024-12-31T23:50:00.000Z').getTime();
            expect(calculateRemainingTime(expireAt)).toBeLessThan(0);
        });

        it('should return 0 for current time', () => {
            const expireAt = Date.now();
            expect(calculateRemainingTime(expireAt)).toBe(0);
        });
    });

    describe('isTimerInWarningState', () => {
        it('should return true for 60 seconds', () => {
            expect(isTimerInWarningState(60000)).toBe(true);
        });

        it('should return true for less than 60 seconds', () => {
            expect(isTimerInWarningState(30000)).toBe(true);
            expect(isTimerInWarningState(1000)).toBe(true);
        });

        it('should return false for more than 60 seconds', () => {
            expect(isTimerInWarningState(60001)).toBe(false);
            expect(isTimerInWarningState(120000)).toBe(false);
        });

        it('should return true for 0', () => {
            expect(isTimerInWarningState(0)).toBe(true);
        });

        it('should return true for negative values', () => {
            expect(isTimerInWarningState(-1000)).toBe(true);
        });
    });

    describe('isTimerExpired', () => {
        it('should return true for 0', () => {
            expect(isTimerExpired(0)).toBe(true);
        });

        it('should return true for negative values', () => {
            expect(isTimerExpired(-1000)).toBe(true);
        });

        it('should return false for positive values', () => {
            expect(isTimerExpired(1000)).toBe(false);
            expect(isTimerExpired(60000)).toBe(false);
        });
    });

    describe('getAriaAnnouncementInterval', () => {
        it('should return 10 seconds for final minute', () => {
            expect(getAriaAnnouncementInterval(60000)).toBe(10000);
            expect(getAriaAnnouncementInterval(30000)).toBe(10000);
            expect(getAriaAnnouncementInterval(1000)).toBe(10000);
        });

        it('should return 60 seconds for more than 1 minute', () => {
            expect(getAriaAnnouncementInterval(60001)).toBe(60000);
            expect(getAriaAnnouncementInterval(120000)).toBe(60000);
            expect(getAriaAnnouncementInterval(600000)).toBe(60000);
        });
    });

    describe('formatAriaAnnouncement', () => {
        it('should format 0 as "Message deleting now"', () => {
            expect(formatAriaAnnouncement(0)).toBe('Message deleting now');
        });

        it('should format minutes and seconds', () => {
            expect(formatAriaAnnouncement(90000)).toBe('1 minute 30 seconds remaining');
            expect(formatAriaAnnouncement(150000)).toBe('2 minutes 30 seconds remaining');
        });

        it('should format only minutes when no seconds', () => {
            expect(formatAriaAnnouncement(60000)).toBe('1 minute remaining');
            expect(formatAriaAnnouncement(120000)).toBe('2 minutes remaining');
        });

        it('should format only seconds when less than 1 minute', () => {
            expect(formatAriaAnnouncement(30000)).toBe('30 seconds remaining');
            expect(formatAriaAnnouncement(1000)).toBe('1 second remaining');
            expect(formatAriaAnnouncement(5000)).toBe('5 seconds remaining');
        });

        it('should use singular for 1 minute', () => {
            expect(formatAriaAnnouncement(60000)).toContain('1 minute');
        });

        it('should use singular for 1 second', () => {
            expect(formatAriaAnnouncement(1000)).toContain('1 second');
        });

        it('should handle negative values as 0', () => {
            expect(formatAriaAnnouncement(-5000)).toBe('Message deleting now');
        });
    });
});
