// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import moment from 'moment';
import React from 'react';

import {fakeDate} from 'tests/helpers/date';
import {act, renderWithContext} from 'tests/react_testing_utils';

/**
 * Helper to compute the expected dateTime attribute value.
 * The Timestamp component uses Luxon's DateTime.fromJSDate(value).toLocal().toISO({includeOffset: false}).
 */
function expectedLocalISO(epochMs: number): string {
    return DateTime.fromMillis(epochMs).toLocal().toISO({includeOffset: false}) ?? '';
}

import Timestamp from './timestamp';

import {RelativeRanges} from './index';

describe('components/timestamp/Timestamp', () => {
    let resetFakeDate: () => void;

    beforeEach(() => {
        resetFakeDate = fakeDate(new Date('2019-05-03T13:20:00Z'));
    });

    afterEach(() => {
        resetFakeDate();
    });

    function daysFromNow(diff: number) {
        const date = new Date();
        date.setDate(date.getDate() + diff);
        return date;
    }

    test('should be wrapped in SemanticTime and support passthrough className and label', () => {
        const {container} = renderWithContext(
            <Timestamp
                useTime={false}
                className='test class'
                label='test label'
            />,
        );
        expect(container).toMatchSnapshot();
        const timeEl = container.querySelector('time');
        expect(timeEl).not.toBeNull();
        expect(timeEl?.className).toBe('test class');
        expect(timeEl?.getAttribute('aria-label')).toBe('test label');
    });

    test('should not be wrapped in SemanticTime', () => {
        const {container} = renderWithContext(
            <Timestamp
                useTime={false}
                useSemanticOutput={false}
            />,
        );
        expect(container).toMatchSnapshot();
        expect(container.querySelector('time')).toBeNull();
    });

    test.each(moment.tz.names())('should render supported timezone %p', (timeZone) => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone={timeZone}
            />,
        );
        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toEqual(expect.any(String));
        expect(timeEl?.textContent).toMatch(/\d{1,2}:\d{2}\s(?:AM|PM|a\.\sm\.|p\.\sm\.)/);
    });

    test('should render title-case Today', () => {
        const {container} = renderWithContext(
            <Timestamp
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_TITLE_CASE,
                ]}
            />,
        );
        expect(container.textContent).toEqual('Today');
    });

    test('should render normal today', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={daysFromNow(0)}
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_YESTERDAY,
                ]}
            />,
        );
        expect(container.textContent).toEqual('today');
    });

    test('should render title-case Yesterday', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={daysFromNow(-1)}
                useTime={false}
                ranges={[
                    RelativeRanges.YESTERDAY_TITLE_CASE,
                ]}
            />,
        );
        expect(container.textContent).toEqual('Yesterday');
    });

    test('should render normal yesterday', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={daysFromNow(-1)}
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_YESTERDAY,
                ]}
            />,
        );
        expect(container.textContent).toEqual('yesterday');
    });

    test('should render normal tomorrow', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={daysFromNow(1)}
                useTime={false}
                unit='day'
            />,
        );
        expect(container.textContent).toEqual('tomorrow');
    });

    test('should render 3 days ago', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={daysFromNow(-3)}
                useTime={false}
                unit='day'
            />,
        );
        expect(container.textContent).toEqual('3 days ago');
    });

    test('should render 3 days ago as weekday', () => {
        const date = daysFromNow(-3);
        const {container} = renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );
        expect(container.textContent).toEqual(moment.utc(date).format('dddd'));
    });

    test('should render 6 days ago as weekday', () => {
        const date = daysFromNow(-6);
        const {container} = renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(container.textContent).toEqual(moment(date).format('dddd'));
    });

    test('should render 2 days ago as weekday in supported timezone', () => {
        const date = daysFromNow(-2);
        const {container} = renderWithContext(
            <Timestamp
                value={date}
                timeZone='Asia/Manila'
                useTime={false}
            />,
        );

        expect(container.textContent).toEqual(moment.utc(date).tz('Asia/Manila').format('dddd'));
    });

    test('should render date in current year', () => {
        const date = daysFromNow(-20);
        const {container} = renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(container.textContent).toEqual(moment.utc(date).format('MMMM DD'));
    });

    test('should render date from previous year', () => {
        const date = daysFromNow(-365);
        const {container} = renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(container.textContent).toEqual(moment.utc(date).format('MMMM DD, YYYY'));
    });

    test('should render time without timezone', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+0800 (+08)').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                useDate={false}
            />,
        );

        // Display text depends on local timezone; compute expected time dynamically
        const localDt = DateTime.fromMillis(value).toLocal();
        const expectedTime = localDt.toFormat('h:mm a');
        expect(container.textContent).toBe(expectedTime);
    });

    test('should render time without timezone, in military time', () => {
        const value = new Date('Fri Jan 12 2018 23:15:13 GMT+0800 (+08)').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                hourCycle='h23'
                useDate={false}
            />,
        );
        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toBe(expectedLocalISO(value));

        const localDt = DateTime.fromMillis(value).toLocal();
        expect(container.textContent).toBe(localDt.toFormat('HH:mm'));
    });

    test('should render date without timezone', () => {
        const value = new Date('Fri Jan 12 2018 23:15:13 GMT+0800 (+08)').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                useTime={false}
            />,
        );

        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toBe(expectedLocalISO(value));

        const localDt = DateTime.fromMillis(value).toLocal();
        expect(container.textContent).toBe(localDt.toFormat('MMMM d, yyyy'));
    });

    test('should render time with timezone enabled', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                useDate={false}
                timeZone='Australia/Sydney'
            />,
        );
        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toBe(expectedLocalISO(value));
        expect(container.textContent).toBe('7:15 AM');
    });

    test('should render time with unsupported timezone', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                useDate={false}
                timeZone='US/Hawaii'
            />,
        );
        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toBe(expectedLocalISO(value));
        expect(container.textContent).toBe('10:15 AM');
    });

    test('should render date with unsupported timezone', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                useTime={false}
                timeZone='US/Hawaii'
            />,
        );
        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toBe(expectedLocalISO(value));
        expect(container.textContent).toBe('January 12, 2018');
    });

    test('should render datetime with timezone enabled, in military time', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT-0800').getTime();
        const {container} = renderWithContext(
            <Timestamp
                value={value}
                hourCycle='h23'
                timeZone='Australia/Sydney'
            />,
        );
        const timeEl = container.querySelector('time');
        expect(timeEl?.getAttribute('dateTime')).toBe(expectedLocalISO(value));
        expect(container.textContent).toBe('January 13, 2018 at 15:15');
    });

    test('should render time with unsupported timezone enabled, in military time', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT-0800 (+00)').getTime()}
                hourCycle='h23'
                useDate={false}
                timeZone='US/Alaska'
            />,
        );
        expect(container.textContent).toBe('19:15');
    });
});

// These use Jest's fake timers rather than the fakeDate helper above, because they need the
// clock and the timer queue to advance together.
describe('components/timestamp/Timestamp day rollover', () => {
    const TEN_SECONDS_BEFORE_MIDNIGHT = new Date('2019-05-03T23:59:50Z');
    const EARLIER_THAT_EVENING = new Date('2019-05-03T20:00:00Z');

    const TODAY_YESTERDAY_RANGES = [
        RelativeRanges.TODAY_TITLE_CASE,
        RelativeRanges.YESTERDAY_TITLE_CASE,
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(TEN_SECONDS_BEFORE_MIDNIGHT);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function advanceBy(millis: number) {
        act(() => {
            jest.advanceTimersByTime(millis);
        });
    }

    test('should relabel Today as Yesterday once the local day changes', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={EARLIER_THAT_EVENING}
                timeZone='UTC'
                useTime={false}
                ranges={TODAY_YESTERDAY_RANGES}
            />,
        );

        expect(container.textContent).toEqual('Today');

        advanceBy(11 * 1000);

        expect(container.textContent).toEqual('Yesterday');
    });

    test('should relabel today as yesterday for day-relative ranges', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={EARLIER_THAT_EVENING}
                timeZone='UTC'
                useTime={false}
                ranges={[RelativeRanges.TODAY_YESTERDAY]}
            />,
        );

        expect(container.textContent).toEqual('today');

        advanceBy(11 * 1000);

        expect(container.textContent).toEqual('yesterday');
    });

    test('should recount the days for a day-relative timestamp without any ranges', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('2019-04-30T20:00:00Z')}
                timeZone='UTC'
                useTime={false}
                unit='day'
            />,
        );

        expect(container.textContent).toEqual('3 days ago');

        advanceBy(11 * 1000);

        expect(container.textContent).toEqual('4 days ago');
    });

    // Each case sits on the last moment of a period, so the next day boundary is also that
    // period's boundary.
    test.each([
        ['week', '2019-05-04T23:59:50Z', '2019-05-01T12:00:00Z'],
        ['month', '2019-04-30T23:59:50Z', '2019-04-15T12:00:00Z'],
        ['quarter', '2019-03-31T23:59:50Z', '2019-02-15T12:00:00Z'],
        ['year', '2018-12-31T23:59:50Z', '2018-06-15T12:00:00Z'],
    ] as const)('should recount whole %ss when the period ends', (unit, now, value) => {
        jest.setSystemTime(new Date(now));

        const {container} = renderWithContext(
            <Timestamp
                value={new Date(value)}
                timeZone='UTC'
                useTime={false}
                units={[unit]}
            />,
        );

        expect(container.textContent).toEqual(`this ${unit}`);

        advanceBy(11 * 1000);

        expect(container.textContent).toEqual(`last ${unit}`);
    });

    // A refresh interval takes priority over the day boundary, which is what keeps the
    // finer-grained ranges ticking at their own rate.
    test('should keep refreshing a minute-relative timestamp on its own interval', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('2019-05-03T23:58:20Z')}
                timeZone='UTC'
                useTime={false}
                units={['minute']}
            />,
        );

        expect(container.textContent).toEqual('1 minute ago');

        advanceBy(31 * 1000);

        expect(container.textContent).toEqual('2 minutes ago');
    });

    test('should catch up after the machine was suspended past midnight', () => {
        const {container, rerender} = renderWithContext(
            <Timestamp
                value={EARLIER_THAT_EVENING}
                timeZone='UTC'
                useTime={false}
                ranges={TODAY_YESTERDAY_RANGES}
            />,
        );

        expect(container.textContent).toEqual('Today');

        // Time moves on without any timer getting a chance to fire.
        jest.setSystemTime(new Date('2019-05-04T08:00:00Z'));

        rerender(
            <Timestamp
                value={new Date(EARLIER_THAT_EVENING.getTime() + 1000)}
                timeZone='UTC'
                useTime={false}
                ranges={TODAY_YESTERDAY_RANGES}
            />,
        );

        expect(container.textContent).toEqual('Yesterday');
    });

    // Covers the branch that refreshes an absolute date format rather than a relative label.
    test('should drop the weekday format once the value is more than six days old', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('2019-04-27T12:00:00Z')}
                timeZone='UTC'
                useTime={false}
            />,
        );

        expect(container.textContent).toEqual('Saturday');

        advanceBy(11 * 1000);

        expect(container.textContent).toEqual('April 27');
    });

    test('should use the given timezone to decide where the day boundary falls', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={EARLIER_THAT_EVENING}
                timeZone='Asia/Tokyo'
                useTime={false}
                ranges={TODAY_YESTERDAY_RANGES}
            />,
        );

        expect(container.textContent).toEqual('Today');

        // Midnight passes in UTC, but it is still the same day in Tokyo.
        advanceBy(11 * 1000);

        expect(container.textContent).toEqual('Today');

        // Midnight in Tokyo.
        advanceBy(15 * 60 * 60 * 1000);

        expect(container.textContent).toEqual('Yesterday');
    });

    // Every post in a channel renders one of these, so a time-only timestamp must not take a timer.
    test('should not schedule an update when only a time is rendered', () => {
        const before = jest.getTimerCount();

        renderWithContext(
            <Timestamp
                value={EARLIER_THAT_EVENING}
                timeZone='UTC'
                useDate={false}
            />,
        );

        expect(jest.getTimerCount()).toBe(before);
    });

    test('should leave no pending update behind after re-renders and unmount', () => {
        const before = jest.getTimerCount();

        const {rerender, unmount} = renderWithContext(
            <Timestamp
                value={EARLIER_THAT_EVENING}
                timeZone='UTC'
                useTime={false}
                className='first'
                ranges={TODAY_YESTERDAY_RANGES}
            />,
        );

        expect(jest.getTimerCount()).toBe(before + 1);

        for (const className of ['second', 'third']) {
            rerender(
                <Timestamp
                    value={EARLIER_THAT_EVENING}
                    timeZone='UTC'
                    useTime={false}
                    className={className}
                    ranges={TODAY_YESTERDAY_RANGES}
                />,
            );
        }

        unmount();

        expect(jest.getTimerCount()).toBe(before);
    });
});
