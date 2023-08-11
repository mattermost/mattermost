// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import BasicSeparator from './basic-separator';
import NotificationSeparator from './notification-separator';

describe('components/widgets/separator', () => {
    test('date separator with text', () => {
        const wrapper = shallow(
            <BasicSeparator>
                {'Some text'}
            </BasicSeparator>,
        );
        expect(wrapper).toMatchSnapshot();
    });
    test('notification message separator without text', () => {
        const wrapper = shallow(<NotificationSeparator/>);
        expect(wrapper).toMatchSnapshot();
    });
    test('notification message separator with text', () => {
        const wrapper = shallow(<NotificationSeparator>{'Some text'}</NotificationSeparator>);
        expect(wrapper).toMatchSnapshot();
    });
});
