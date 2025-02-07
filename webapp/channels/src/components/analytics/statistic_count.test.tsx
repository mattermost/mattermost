// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import StatisticCount from 'components/analytics/statistic_count';

describe('components/analytics/statistic_count.tsx', () => {
    test('should match snapshot, on loading', () => {
        const wrapper = shallow(
            <StatisticCount
                title='Test'
                icon='test-icon'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded', () => {
        const wrapper = shallow(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={4}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded with zero value', () => {
        const wrapper = shallow(
            <StatisticCount
                title='Test Zero'
                icon='test-icon'
                count={0}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should apply formatter function when provided', () => {
        const mockFormatter = (value: number) => `${value}%`;
        const wrapper = shallow(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={42}
                id='test-stat'
                formatter={mockFormatter}
            />,
        );

        expect(wrapper.find('[data-testid="test-stat"]').text()).toBe('42%');
    });
});
