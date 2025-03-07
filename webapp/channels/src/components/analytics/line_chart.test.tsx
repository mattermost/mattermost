// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import LineChart from 'components/analytics/line_chart';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('chart.js/auto', () => {
    return jest.fn().mockImplementation(() => {
        return {
            destroy: jest.fn(),
            update: jest.fn(),
        };
    });
});

describe('components/analytics/line_chart.tsx', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should show loading message when data is not provided', () => {
        renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
            />,
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should show "not enough data" message when data has no labels', () => {
        const data = {
            datasets: [],
            labels: [],
        };

        renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(screen.getByText('Not enough data for a meaningful representation.')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should render chart when provided with valid data', () => {
        const data = {
            datasets: [
                {data: [1, 2, 3]},
            ],
            labels: ['test1', 'test2', 'test3'],
        };

        renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByTestId('test')).toBeInTheDocument();
        expect(screen.getByTestId('test').tagName.toLowerCase()).toBe('canvas');
    });
});
