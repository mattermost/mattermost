// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import LoadingSpinner from './loading_spinner';

describe('components/widgets/loadingLoadingSpinner', () => {
    test('showing spinner with text', () => {
        const wrapper = shallow(<LoadingSpinner text='test'/>);
        expect(wrapper).toMatchSnapshot();
    });
    test('showing spinner without text', () => {
        const wrapper = shallow(<LoadingSpinner/>);
        expect(wrapper).toMatchSnapshot();
    });
});
