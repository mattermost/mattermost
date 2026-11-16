// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import StatisticCount from './statistic_count';

describe('components/analytics/statistic_count.tsx', () => {
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

        expect(screen.getByTestId('test-stat')).toHaveTextContent('42%');
    });
});
