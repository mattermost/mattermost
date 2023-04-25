// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';
import moment from 'moment-timezone';

import {General} from 'mattermost-redux/constants';
import * as i18Selectors from 'selectors/i18n';

import mockStore from 'tests/test_store';

import DateTimeInput from './date_time_input';

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
});
