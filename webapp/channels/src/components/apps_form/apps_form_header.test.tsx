// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import AppsFormHeader from './apps_form_header';

describe('components/apps_form/AppsFormHeader', () => {
    test('should render message with supported values', () => {
        const props = {
            id: 'testsupported',
            value: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        };
        const wrapper = shallow(<AppsFormHeader {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not fail on empty value', () => {
        const props = {
            id: 'testblankvalue',
            value: '',
        };
        const wrapper = shallow(<AppsFormHeader {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
