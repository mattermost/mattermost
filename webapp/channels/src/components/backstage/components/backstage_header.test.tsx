// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BackstageHeader from 'components/backstage/components/backstage_header';

describe('components/backstage/components/BackstageHeader', () => {
    test('should match snapshot without children', () => {
        const wrapper = shallow(
            <BackstageHeader/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const wrapper = shallow(
            <BackstageHeader>
                <div>{'Child 1'}</div>
                <div>{'Child 2'}</div>
            </BackstageHeader>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
