// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentType} from 'react';

import {mount} from 'enzyme';

import withUseGetUsageDeltas from './with_use_get_usage_deltas';

jest.mock('components/common/hooks/useGetUsageDeltas', () => jest.fn(() => ({
    teams: {
        active: -1,
    },
})));

describe('/components/common/hocs/cloud/with_use_get_usage_deltas', () => {
    const TestComponent: ComponentType = jest.fn(() => <div/>);

    test('should pass the useGetUsageDeltas', () => {
        const WrappedComponent = withUseGetUsageDeltas(TestComponent);

        const wrapper = mount(
            <WrappedComponent/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
