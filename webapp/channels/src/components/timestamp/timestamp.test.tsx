// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import moment from 'moment';
import React from 'react';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext} from 'tests/react_testing_utils';

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
