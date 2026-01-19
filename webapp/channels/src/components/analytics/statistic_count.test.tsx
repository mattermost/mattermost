// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithIntl} from 'tests/react_testing_utils';

import StatisticCount from './statistic_count';

describe('components/analytics/statistic_count.tsx', () => {
    test('should match snapshot, on loading', () => {
        const {container} = renderWithIntl(
            <StatisticCount
                title='Test'
                icon='test-icon'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded', () => {
        const {container} = renderWithIntl(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={4}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with zero value', () => {
        const {container} = renderWithIntl(
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
        renderWithIntl(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={42}
                id='test-stat'
                formatter={mockFormatter}
            />,
        );

        expect(screen.getByTestId('test-stat')).toHaveTextContent('42%');
    });
});
