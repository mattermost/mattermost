// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LineChart from 'components/analytics/line_chart';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

// Mock chart.js/auto completely to avoid canvas context issues
vi.mock('chart.js/auto', () => {
    return {
        default: class MockChart {
            data = {};
            destroy = vi.fn();
            update = vi.fn();
        },
    };
});

// Mock HTMLCanvasElement.prototype.getContext to avoid canvas context issues
beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        setTransform: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(0),
        }),
        putImageData: vi.fn(),
        createImageData: vi.fn().mockReturnValue([]),
        setLineDash: vi.fn(),
        measureText: vi.fn().mockReturnValue({width: 0}),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        beginPath: vi.fn(),
        createPattern: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
            addColorStop: vi.fn(),
        }),
        createRadialGradient: vi.fn().mockReturnValue({
            addColorStop: vi.fn(),
        }),
    });
});

describe('components/analytics/line_chart.tsx', () => {
    test('should match snapshot, on loading', async () => {
        const {container} = renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
            />,
        );

        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded without data', async () => {
        const data = {
            datasets: [],
            labels: [],
        };

        const {container} = renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', async () => {
        const data = {
            datasets: [
                {data: [1, 2, 3]},
            ],
            labels: ['test1', 'test2', 'test3'],
        };

        const {container} = renderWithContext(
            <LineChart
                id='test'
                title='Test'
                height={400}
                width={600}
                data={data}
            />,
        );

        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
