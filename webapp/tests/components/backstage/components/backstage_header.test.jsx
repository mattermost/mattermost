// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';

describe('components/backstage/components/BackstageHeader', () => {
    test('should match snapshot without children', () => {
        const wrapper = shallow(
            <BackstageHeader/>
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const wrapper = shallow(
            <BackstageHeader>
                <div>{'Child 1'}</div>
                <div>{'Child 2'}</div>
            </BackstageHeader>
        );
        expect(wrapper).toMatchSnapshot();
    });
});
