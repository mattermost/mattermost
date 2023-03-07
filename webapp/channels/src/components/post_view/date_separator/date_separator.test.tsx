// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import BasicSeparator from 'components/widgets/separator/basic-separator';
import DateSeparator from 'components/post_view/date_separator/date_separator';
import Timestamp from 'components/timestamp';

describe('components/post_view/DateSeparator', () => {
    test('should render Timestamp inside of a BasicSeparator and pass date/value to it', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+1200 (+12)');
        const wrapper = shallow(
            <DateSeparator
                date={value}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find(BasicSeparator).exists());

        expect(wrapper.find(Timestamp).prop('value')).toBe(value);
    });
});
