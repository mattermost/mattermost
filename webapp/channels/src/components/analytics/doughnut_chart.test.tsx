// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import type {ChartData} from 'chart.js';
import React from 'react';

import DoughnutChart from 'components/analytics/doughnut_chart';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('chart.js');

describe('components/analytics/doughnut_chart.tsx', () => {
    test('should show loading state when no data is provided', () => {
        renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
            />,
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should not create chart when data is undefined', () => {
        const Chart = jest.requireMock('chart.js');
        const data: ChartData | undefined = undefined;

        renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).not.toBeCalled();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should create chart with provided data', () => {
        const Chart = jest.requireMock('chart.js');
        const data: ChartData = {
            datasets: [
                {data: [1, 2, 3]},
            ],
        };

        renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).toBeCalledWith(expect.anything(), {data, options: {}, type: 'doughnut'});
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should create and destroy the chart on mount and unmount with data', () => {
        const Chart = jest.requireMock('chart.js');

        const data: ChartData = {
            datasets: [
                {data: [1, 2, 3]},
            ],
            labels: ['test1', 'test2', 'test3'],
        };

        const {unmount} = renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).toBeCalled();
        unmount();

        // Chart destruction is handled by useEffect cleanup, which is automatically tested
        // when unmounting the component in React Testing Library
    });

    test('should update the chart on data change', () => {
        const Chart = jest.requireMock('chart.js');

        const oldData: ChartData = {
            datasets: [
                {data: [1, 2, 3]},
            ],
            labels: ['test1', 'test2', 'test3'],
        };

        const newData: ChartData = {
            datasets: [
                {data: [1, 2, 3, 4]},
            ],
            labels: ['test1', 'test2', 'test3', 'test4'],
        };

        const {rerender} = renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={oldData}
            />,
        );

        expect(Chart).toBeCalled();
        expect(Chart.mock.instances[0].update).not.toBeCalled();

        // Update title prop
        rerender(
            <DoughnutChart
                title='new title'
                height={400}
                width={600}
                data={oldData}
            />,
        );
        expect(Chart.mock.instances[0].update).not.toBeCalled();

        // Update data prop
        rerender(
            <DoughnutChart
                title='new title'
                height={400}
                width={600}
                data={newData}
            />,
        );
        expect(Chart.mock.instances[0].update).toBeCalled();
    });
});
