// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

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

        const timeElement = container.querySelector('time');
        expect(timeElement).toBeInTheDocument();
        expect(timeElement).toHaveClass('test', 'class');
        expect(timeElement).toHaveAttribute('aria-label', 'test label');
    });

    test('should not be wrapped in SemanticTime', () => {
        const {container} = renderWithContext(
            <Timestamp
                useTime={false}
                useSemanticOutput={false}
            />,
        );
        expect(container).toMatchSnapshot();

        const timeElement = container.querySelector('time');
        expect(timeElement).not.toBeInTheDocument();
    });

    test.each(moment.tz.names())('should render supported timezone %p', (timeZone) => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone={timeZone}
            />,
            {},
            {
                locale: 'es',
            },
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime');
        expect(container.textContent).toMatch(/\d{1,2}:\d{2}\s(?:AM|PM|a\.\sm\.|p\.\sm\.)/);
    });

    test('should render title-case Today', () => {
        renderWithContext(
            <Timestamp
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_TITLE_CASE,
                ]}
            />,
        );
        expect(screen.getByText('Today')).toBeInTheDocument();
    });

    test('should render normal today', () => {
        renderWithContext(
            <Timestamp
                value={daysFromNow(0)}
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_YESTERDAY,
                ]}
            />,
        );
        expect(screen.getByText('today')).toBeInTheDocument();
    });

    test('should render title-case Yesterday', () => {
        renderWithContext(
            <Timestamp
                value={daysFromNow(-1)}
                useTime={false}
                ranges={[
                    RelativeRanges.YESTERDAY_TITLE_CASE,
                ]}
            />,
        );
        expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    test('should render normal yesterday', () => {
        renderWithContext(
            <Timestamp
                value={daysFromNow(-1)}
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_YESTERDAY,
                ]}
            />,
        );
        expect(screen.getByText('yesterday')).toBeInTheDocument();
    });

    test('should render normal tomorrow', () => {
        renderWithContext(
            <Timestamp
                value={daysFromNow(1)}
                useTime={false}
                unit='day'
            />,
        );
        expect(screen.getByText('tomorrow')).toBeInTheDocument();
    });

    test('should render 3 days ago', () => {
        renderWithContext(
            <Timestamp
                value={daysFromNow(-3)}
                useTime={false}
                unit='day'
            />,
        );
        expect(screen.getByText('3 days ago')).toBeInTheDocument();
    });

    test('should render 3 days ago as weekday', () => {
        const date = daysFromNow(-3);
        renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );
        expect(screen.getByText(moment.utc(date).format('dddd'))).toBeInTheDocument();
    });

    test('should render 6 days ago as weekday', () => {
        const date = daysFromNow(-6);
        renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(screen.getByText(moment(date).format('dddd'))).toBeInTheDocument();
    });

    test('should render 2 days ago as weekday in supported timezone', () => {
        const date = daysFromNow(-2);
        renderWithContext(
            <Timestamp
                value={date}
                timeZone='Asia/Manila'
                useTime={false}
            />,
        );

        expect(screen.getByText(moment.utc(date).tz('Asia/Manila').format('dddd'))).toBeInTheDocument();
    });

    test('should render date in current year', () => {
        const date = daysFromNow(-20);
        renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(screen.getByText(moment.utc(date).format('MMMM DD'))).toBeInTheDocument();
    });

    test('should render date from previous year', () => {
        const date = daysFromNow(-365);
        renderWithContext(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(screen.getByText(moment.utc(date).format('MMMM DD, YYYY'))).toBeInTheDocument();
    });

    test('should render time without timezone', () => {
        renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0800 (+08)').getTime()}
                useDate={false}
            />,
        );
        expect(screen.getByText('12:15 PM')).toBeInTheDocument();
    });

    test('should render time without timezone, in military time', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 23:15:13 GMT+0800 (+08)').getTime()}
                hourCycle='h23'
                useDate={false}
            />,
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2018-01-12T15:15:13.000');
        expect(screen.getByText('15:15')).toBeInTheDocument();
    });

    test('should render date without timezone', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 23:15:13 GMT+0800 (+08)').getTime()}
                useTime={false}
            />,
        );

        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2018-01-12T15:15:13.000');
        expect(screen.getByText('January 12, 2018')).toBeInTheDocument();
    });

    test('should render time with timezone enabled', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone='Australia/Sydney'
            />,
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2018-01-12T20:15:13.000');
        expect(screen.getByText('7:15 AM')).toBeInTheDocument();
    });

    test('should render time with unsupported timezone', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone='US/Hawaii'
            />,
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2018-01-12T20:15:13.000');
        expect(screen.getByText('10:15 AM')).toBeInTheDocument();
    });

    test('should render date with unsupported timezone', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useTime={false}
                timeZone='US/Hawaii'
            />,
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2018-01-12T20:15:13.000');
        expect(screen.getByText('January 12, 2018')).toBeInTheDocument();
    });

    test('should render datetime with timezone enabled, in military time', () => {
        const {container} = renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT-0800').getTime()}
                hourCycle='h23'
                timeZone='Australia/Sydney'
            />,
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2018-01-13T04:15:13.000');
        expect(screen.getByText('January 13, 2018 at 15:15')).toBeInTheDocument();
    });

    test('should render time with unsupported timezone enabled, in military time', () => {
        renderWithContext(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT-0800 (+00)').getTime()}
                hourCycle='h23'
                useDate={false}
                timeZone='US/Alaska'
            />,
        );
        expect(screen.getByText('19:15')).toBeInTheDocument();
    });
});
