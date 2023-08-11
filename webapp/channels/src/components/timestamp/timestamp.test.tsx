// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createIntl} from 'react-intl';

import moment from 'moment';

import defaultMessages from 'i18n/en.json';
import {fakeDate} from 'tests/helpers/date';
import {shallowWithIntl, mountWithIntl} from 'tests/helpers/intl-test-helper';

import SemanticTime from './semantic_time';
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
        const wrapper = shallowWithIntl(
            <Timestamp
                useTime={false}
                className='test class'
                label='test label'
            />,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SemanticTime).exists()).toBeTruthy();
        expect(wrapper.find(SemanticTime).prop('className')).toBe('test class');
        expect(wrapper.find(SemanticTime).prop('aria-label')).toBe('test label');
    });

    test('should not be wrapped in SemanticTime', () => {
        const wrapper = shallowWithIntl(
            <Timestamp
                useTime={false}
                useSemanticOutput={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SemanticTime).exists()).toBeFalsy();
    });

    test.each(moment.tz.names())('should render supported timezone %p', (timeZone) => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone={timeZone}
            />,
            {
                intl: createIntl({
                    locale: 'es',
                    defaultLocale: 'es',
                    timeZone: 'Etc/UTC',
                    messages: defaultMessages,
                    textComponent: 'span',
                }),
            },
        );
        expect(wrapper.find('time').prop('dateTime')).toEqual(expect.any(String));
        expect(wrapper.text()).toMatch(/\d{1,2}:\d{2}\s(?:AM|PM|a\.\sm\.|p\.\sm\.)/);
    });

    test('should render title-case Today', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_TITLE_CASE,
                ]}
            />,
        );
        expect(wrapper.text()).toEqual('Today');
    });

    test('should render normal today', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={daysFromNow(0)}
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_YESTERDAY,
                ]}
            />,
        );
        expect(wrapper.text()).toEqual('today');
    });

    test('should render title-case Yesterday', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={daysFromNow(-1)}
                useTime={false}
                ranges={[
                    RelativeRanges.YESTERDAY_TITLE_CASE,
                ]}
            />,
        );
        expect(wrapper.text()).toEqual('Yesterday');
    });

    test('should render normal yesterday', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={daysFromNow(-1)}
                useTime={false}
                ranges={[
                    RelativeRanges.TODAY_YESTERDAY,
                ]}
            />,
        );
        expect(wrapper.text()).toEqual('yesterday');
    });

    test('should render normal tomorrow', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={daysFromNow(1)}
                useTime={false}
                unit='day'
            />,
        );
        expect(wrapper.text()).toEqual('tomorrow');
    });

    test('should render 3 days ago', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={daysFromNow(-3)}
                useTime={false}
                unit='day'
            />,
        );
        expect(wrapper.text()).toEqual('3 days ago');
    });

    test('should render 3 days ago as weekday', () => {
        const date = daysFromNow(-3);
        const wrapper = mountWithIntl(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );
        expect(wrapper.text()).toEqual(moment.utc(date).format('dddd'));
    });

    test('should render 6 days ago as weekday', () => {
        const date = daysFromNow(-6);
        const wrapper = mountWithIntl(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(wrapper.text()).toEqual(moment(date).format('dddd'));
    });

    test('should render 2 days ago as weekday in supported timezone', () => {
        const date = daysFromNow(-2);
        const wrapper = mountWithIntl(
            <Timestamp
                value={date}
                timeZone='Asia/Manila'
                useTime={false}
            />,
        );

        expect(wrapper.text()).toEqual(moment.utc(date).tz('Asia/Manila').format('dddd'));
    });

    test('should render date in current year', () => {
        const date = daysFromNow(-20);
        const wrapper = mountWithIntl(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(wrapper.text()).toEqual(moment.utc(date).format('MMMM DD'));
    });

    test('should render date from previous year', () => {
        const date = daysFromNow(-365);
        const wrapper = mountWithIntl(
            <Timestamp
                value={date}
                useTime={false}
            />,
        );

        expect(wrapper.text()).toEqual(moment.utc(date).format('MMMM DD, YYYY'));
    });

    test('should render time without timezone', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0800 (+08)').getTime()}
                useDate={false}
            />,
        );
        expect(wrapper.text()).toBe('12:15 PM');
    });

    test('should render time without timezone, in military time', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 23:15:13 GMT+0800 (+08)').getTime()}
                hourCycle='h23'
                useDate={false}
            />,
        );
        expect(wrapper.find('time').prop('dateTime')).toBe('2018-01-12T15:15:13.000');
        expect(wrapper.text()).toBe('15:15');
    });

    test('should render date without timezone', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 23:15:13 GMT+0800 (+08)').getTime()}
                useTime={false}
            />,
        );

        expect(wrapper.find('time').prop('dateTime')).toBe('2018-01-12T15:15:13.000');
        expect(wrapper.text()).toBe('January 12, 2018');
    });

    test('should render time with timezone enabled', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone='Australia/Sydney'
            />,
        );
        expect(wrapper.find('time').prop('dateTime')).toBe('2018-01-12T20:15:13.000');
        expect(wrapper.text()).toBe('7:15 AM');
    });

    test('should render time with unsupported timezone', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useDate={false}
                timeZone='US/Hawaii'
            />,
        );
        expect(wrapper.find('time').prop('dateTime')).toBe('2018-01-12T20:15:13.000');
        expect(wrapper.text()).toBe('10:15 AM');
    });

    test('should render date with unsupported timezone', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT+0000 (+00)').getTime()}
                useTime={false}
                timeZone='US/Hawaii'
            />,
        );
        expect(wrapper.find('time').prop('dateTime')).toBe('2018-01-12T20:15:13.000');
        expect(wrapper.text()).toBe('January 12, 2018');
    });

    test('should render datetime with timezone enabled, in military time', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT-0800').getTime()}
                hourCycle='h23'
                timeZone='Australia/Sydney'
            />,
        );
        expect(wrapper.find('time').prop('dateTime')).toBe('2018-01-13T04:15:13.000');
        expect(wrapper.text()).toBe('January 13, 2018 at 15:15');
    });

    test('should render time with unsupported timezone enabled, in military time', () => {
        const wrapper = mountWithIntl(
            <Timestamp
                value={new Date('Fri Jan 12 2018 20:15:13 GMT-0800 (+00)').getTime()}
                hourCycle='h23'
                useDate={false}
                timeZone='US/Alaska'
            />,
        );
        expect(wrapper.text()).toBe('19:15');
    });
});
