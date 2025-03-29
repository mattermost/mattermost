// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import TableChart from 'components/analytics/table_chart';
import type {TableItem} from 'components/analytics/table_chart';

import {renderWithContext} from 'tests/react_testing_utils';

// Mock the WithTooltip component to make testing easier
jest.mock('components/with_tooltip', () => {
    return ({children, title}: {children: React.ReactNode; title: string}) => (
        <div data-tooltip={title}>
            {children}
        </div>
    );
});

describe('components/analytics/table_chart.tsx', () => {
    test('should render correctly without data', () => {
        const data: TableItem[] = [];

        renderWithContext(
            <TableChart
                title='Test'
                data={data}
            />,
        );

        expect(screen.getByText('Test')).toBeInTheDocument();

        // Should render an empty table with no rows
        expect(screen.queryByRole('row')).not.toBeInTheDocument();
    });

    test('should render correctly with data', () => {
        const data = [
            {name: 'test1', tip: 'test-tip1', value: <p>{'test-value1'}</p>},
            {name: 'test2', tip: 'test-tip2', value: <p>{'test-value2'}</p>},
        ];

        renderWithContext(
            <TableChart
                title='Test'
                data={data}
            />,
        );

        expect(screen.getByText('Test')).toBeInTheDocument();

        // Check first row
        expect(screen.getByText('test1')).toBeInTheDocument();
        expect(screen.getByText('test-value1')).toBeInTheDocument();
        expect(screen.getByText('test1').closest('div')).toHaveAttribute('data-tooltip', 'test-tip1');

        // Check second row
        expect(screen.getByText('test2')).toBeInTheDocument();
        expect(screen.getByText('test-value2')).toBeInTheDocument();
        expect(screen.getByText('test2').closest('div')).toHaveAttribute('data-tooltip', 'test-tip2');
    });
});
