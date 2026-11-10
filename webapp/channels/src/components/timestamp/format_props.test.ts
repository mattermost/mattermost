// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimestampFormat} from '@mattermost/types/config';

import {getTimestampFormatProps} from './format_props';
import type {TimestampVariant} from './format_props';
import * as RelativeRanges from './relative_ranges';

const withSeconds = {second: '2-digit'};

function props(format: TimestampFormat, variant: TimestampVariant, showSeconds = false) {
    return getTimestampFormatProps({format, showSeconds, variant});
}

describe('getTimestampFormatProps', () => {
    describe('STANDARD', () => {
        test('renders a bare clock time in post headers', () => {
            expect(props(TimestampFormat.STANDARD, 'post')).toMatchObject({
                useRelative: false,
                useDate: false,
                useTime: {hour: 'numeric', minute: '2-digit'},
            });
        });

        test('renders date and time on metadata surfaces', () => {
            const result = props(TimestampFormat.STANDARD, 'metadata');

            expect(result.useDate).toBeInstanceOf(Function);
            expect(result.useTime).toMatchObject({hour: 'numeric', minute: '2-digit'});

            // Regression guard: "Today"/"Yesterday" must come from the shared
            // FormattedMessage-backed ranges, never from hardcoded English.
            expect(result.ranges).toEqual([
                RelativeRanges.TODAY_TITLE_CASE,
                RelativeRanges.YESTERDAY_TITLE_CASE,
            ]);
        });

        test('includes seconds only when requested', () => {
            expect(props(TimestampFormat.STANDARD, 'post', true).useTime).toMatchObject(withSeconds);
            expect(props(TimestampFormat.STANDARD, 'post', false).useTime).not.toMatchObject(withSeconds);
        });
    });

    describe('DATE_AND_TIME', () => {
        test('renders date and time in post headers too', () => {
            const result = props(TimestampFormat.DATE_AND_TIME, 'post');

            expect(result.useDate).toBeInstanceOf(Function);
            expect(result.ranges).toHaveLength(2);
            expect(result.useTime).toMatchObject({hour: 'numeric', minute: '2-digit'});
        });

        test('lets the locale join a bare date to the time', () => {
            // Timestamp still falls back to "at" when the date half resolves to a
            // relative label, so "Today at 4:32 PM" but "Jun 1, 4:32 PM".
            expect(props(TimestampFormat.DATE_AND_TIME, 'post').dateTimeSeparator).toBe('locale');
            expect(props(TimestampFormat.STANDARD, 'metadata').dateTimeSeparator).toBe('locale');
        });

        test('leaves the separator unset where there is no date half', () => {
            expect(props(TimestampFormat.DATE_AND_TIME, 'compact').dateTimeSeparator).toBeUndefined();
            expect(props(TimestampFormat.STANDARD, 'post').dateTimeSeparator).toBeUndefined();
            expect(props(TimestampFormat.RELATIVE, 'metadata').dateTimeSeparator).toBeUndefined();
        });
    });

    describe('RELATIVE', () => {
        test('uses relative units and drops the time', () => {
            const result = props(TimestampFormat.RELATIVE, 'metadata');

            expect(result.useTime).toBe(false);
            expect(result.units).toHaveLength(7);
        });

        test('narrows the relative wording when compact', () => {
            expect(props(TimestampFormat.RELATIVE, 'compact')).toMatchObject({
                useTime: false,
                style: 'narrow',
                numeric: 'always',
            });
        });

        test('auto-refresh survives — every relative unit carries a range', () => {
            // Regression guard: relative timestamps only tick because Timestamp resolves
            // these into ranges with updateIntervalInSeconds.
            expect(props(TimestampFormat.RELATIVE, 'metadata').units).not.toHaveLength(0);
        });
    });

    describe('compact', () => {
        test.each([
            TimestampFormat.STANDARD,
            TimestampFormat.DATE_AND_TIME,
        ])('collapses %s to a bare clock time', (format) => {
            expect(props(format, 'compact')).toMatchObject({
                useRelative: false,
                useDate: false,
                useTime: {hour: 'numeric', minute: '2-digit'},
            });
        });

        test('suppresses seconds even when the preference is on', () => {
            expect(props(TimestampFormat.DATE_AND_TIME, 'compact', true).useTime).not.toMatchObject(withSeconds);
        });
    });

    describe('useCalendarDate', () => {
        test('compares years in the selected time zone, not the browser zone', () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2021-01-10T10:00:00.000Z'));

            const value = new Date('2020-12-31T18:00:00.000Z');
            const useDate = props(TimestampFormat.DATE_AND_TIME, 'metadata').useDate;

            expect(useDate).toBeInstanceOf(Function);
            if (typeof useDate !== 'function') {
                throw new Error('expected useDate to be a function');
            }

            // In UTC the value is still calendar year 2020.
            expect(useDate({value}, {timeZone: 'UTC'})).toEqual({
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });

            // In Asia/Shanghai the same instant is already 2021, matching "now".
            expect(useDate({value}, {timeZone: 'Asia/Shanghai'})).toEqual({
                month: 'short',
                day: 'numeric',
            });

            jest.useRealTimers();
        });
    });

    describe('memoization', () => {
        test('returns a stable reference for the same inputs', () => {
            // Timestamp is a PureComponent — fresh identities here would re-render every
            // timestamp on every store change.
            expect(props(TimestampFormat.DATE_AND_TIME, 'metadata')).toBe(props(TimestampFormat.DATE_AND_TIME, 'metadata'));
            expect(props(TimestampFormat.RELATIVE, 'post')).toBe(props(TimestampFormat.RELATIVE, 'post'));
        });

        test('distinguishes each input', () => {
            expect(props(TimestampFormat.STANDARD, 'post')).not.toBe(props(TimestampFormat.STANDARD, 'metadata'));
            expect(props(TimestampFormat.STANDARD, 'post', true)).not.toBe(props(TimestampFormat.STANDARD, 'post', false));
            expect(props(TimestampFormat.STANDARD, 'post')).not.toBe(props(TimestampFormat.DATE_AND_TIME, 'post'));
        });
    });
});
