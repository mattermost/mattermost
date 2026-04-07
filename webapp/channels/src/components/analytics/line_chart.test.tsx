// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import LineChart from './line_chart';

describe('components/analytics/line_chart.tsx', () => {
    test('should match snapshot, on loading', async () => {
        const {container} = await renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded without data', async () => {
        const data = {
            datasets: [],
            labels: [],
        };

        const {container} = await renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', async () => {
        const data = {
            datasets: [
                {data: [1, 2, 3]},
            ],
            labels: ['test1', 'test2', 'test3'],
        };

        const {container} = await renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
