// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import StatisticCount from 'components/analytics/statistic_count';

describe('components/analytics/statistic_count.tsx', () => {
    test('should show loading message when count is not provided', () => {
        render(
            <StatisticCount
                title='Test'
                icon='test-icon'
            />,
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should display count when provided', () => {
        render(
            <StatisticCount
                title='Test'
                icon='test-icon'
                count={4}
                id='test-stat'
            />,
        );

        expect(screen.getByTestId('test-stat')).toHaveTextContent('4');
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should display zero count when provided', () => {
        render(
            <StatisticCount
                title='Test Zero'
                icon='test-icon'
                count={0}
                id='test-zero'
            />,
        );

        expect(screen.getByTestId('test-zero')).toHaveTextContent('0');
        expect(screen.getByText('Test Zero')).toBeInTheDocument();
    });

    test('should apply formatter function when provided', () => {
        const mockFormatter = (value: number) => `${value}%`;
        render(
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

    test('should apply status classes when provided', () => {
        render(
            <StatisticCount
                title='Warning Test'
                icon='test-icon'
                count={99}
                id='warning-stat'
                status='warning'
            />,
        );

        const titleElement = screen.getByTestId('warning-statTitle');
        const contentElement = screen.getByTestId('warning-stat');
        
        expect(titleElement).toHaveClass('team_statistics--warning');
        expect(contentElement).toHaveClass('team_statistics--warning');
    });
});
