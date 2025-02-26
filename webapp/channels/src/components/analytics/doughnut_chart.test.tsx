// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChartData} from 'chart.js';
import {shallow, mount} from 'enzyme';
import React from 'react';

import DoughnutChart from 'components/analytics/doughnut_chart';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

jest.mock('chart.js');

describe('components/analytics/doughnut_chart.tsx', () => {
    test('should match snapshot, on loading', () => {
        const wrapper = shallow(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded without data', () => {
        const Chart = jest.requireMock('chart.js');
        const data: ChartData | undefined = undefined;

        const wrapper = mountWithIntl(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).not.toBeCalled();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', () => {
        const Chart = jest.requireMock('chart.js');
        const data: ChartData = {
            datasets: [
                {data: [1, 2, 3]},
            ],
        };

        const wrapper = mount(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).toBeCalledWith(expect.anything(), {data, options: {}, type: 'doughnut'});
        expect(wrapper).toMatchSnapshot();
    });

    test('should create and destroy the chart on mount and unmount with data', () => {
        const Chart = jest.requireMock('chart.js');

        const data: ChartData = {
            datasets: [
                {data: [1, 2, 3]},
            ],
            labels: ['test1', 'test2', 'test3'],
        };

        const wrapper = mountWithIntl(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(Chart).toBeCalled();
        wrapper.unmount();
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

        const wrapper = mountWithIntl(
            <DoughnutChart
                title='Test'
                height={400}
                width={600}
                data={oldData}
            />,
        );

        expect(Chart).toBeCalled();
        expect(Chart.mock.instances[0].update).not.toBeCalled();

        wrapper.setProps({title: 'new title'});
        expect(Chart.mock.instances[0].update).not.toBeCalled();

        wrapper.setProps({data: newData});
        expect(Chart.mock.instances[0].update).toBeCalled();
    });
});
