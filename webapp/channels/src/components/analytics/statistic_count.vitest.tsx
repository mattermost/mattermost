// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import StatisticCount from 'components/analytics/statistic_count';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/analytics/statistic_count.tsx', () => {
    test('should match snapshot, on loading', () => {
        const {container} = renderWithContext(
            <StatisticCount
                title='Test'
                icon='test-icon'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded', () => {
        const {container} = renderWithContext(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={4}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with zero value', () => {
        const {container} = renderWithContext(
            <StatisticCount
                title='Test Zero'
                icon='test-icon'
                count={0}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should apply formatter function when provided', () => {
        const mockFormatter = (value: number) => `${value}%`;
        renderWithContext(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={42}
                id='test-stat'
                formatter={mockFormatter}
            />,
        );

        expect(screen.getByTestId('test-stat').textContent).toBe('42%');
    });
});
