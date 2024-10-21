// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import moment from 'moment-timezone';
import React from 'react';
import {Provider} from 'react-redux';

import {General} from 'mattermost-redux/constants';

import * as i18Selectors from 'selectors/i18n';

import mockStore from 'tests/test_store';

import DateTimeInput, {getTimeInIntervals} from './date_time_input';

jest.mock('selectors/i18n');

describe('components/custom_status/date_time_input', () => {
    const store = mockStore({});

    (i18Selectors.getCurrentLocale as jest.Mock).mockReturnValue(General.DEFAULT_LOCALE);
    const baseProps = {
        time: moment('2021-05-03T14:53:39.127Z'),
        handleChange: jest.fn(),
        timezone: 'Australia/Sydney',
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <DateTimeInput {...baseProps}/>
            </Provider>,
        );
        expect(wrapper.dive()).toMatchSnapshot();
    });

    it.each([
        ['2024-03-02T02:00:00+0100', 48],
        ['2024-03-31T02:00:00+0100', 46],
        ['2024-10-07T02:00:00+0100', 48],
        ['2024-10-27T02:00:00+0100', 48],
        ['2025-01-01T03:00:00+0200', 48],
    ])('should not infinitely loop on DST', (time, expected) => {
        const timezone = 'Europe/Paris';

        const intervals = getTimeInIntervals(moment.tz(time, timezone).startOf('day'));
        expect(intervals).toHaveLength(expected);
    });
});
