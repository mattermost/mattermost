// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChartData} from 'chart.js';
import React from 'react';

import DoughnutChart from 'components/analytics/doughnut_chart';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('chart.js');

describe('components/analytics/doughnut_chart.tsx', () => {
    test('should match snapshot, on loading', () => {
        const {container} = renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded without data', () => {
        const Chart = jest.requireMock('chart.js');
        const data: ChartData | undefined = undefined;

        const {container} = renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).not.toHaveBeenCalled();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', () => {
        const Chart = jest.requireMock('chart.js');
        const data: ChartData = {
            datasets: [
                {data: [1, 2, 3]},
            ],
        };

        const {container} = renderWithContext(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).toHaveBeenCalledWith(expect.anything(), {data, options: {}, type: 'doughnut'});
        expect(container).toMatchSnapshot();
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

        expect(Chart).toHaveBeenCalled();
        unmount();
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

        expect(Chart).toHaveBeenCalled();
        expect(Chart.mock.instances[0].update).not.toHaveBeenCalled();

        rerender(
            <DoughnutChart
                title='new title'
                height={400}
                width={600}
                data={oldData}
            />,
        );
        expect(Chart.mock.instances[0].update).not.toHaveBeenCalled();

        rerender(
            <DoughnutChart
                title='new title'
                height={400}
                width={600}
                data={newData}
            />,
        );
        expect(Chart.mock.instances[0].update).toHaveBeenCalled();
    });
});
