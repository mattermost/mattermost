// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import TableChart from 'components/analytics/table_chart';
import type {TableItem} from 'components/analytics/table_chart';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/analytics/table_chart.tsx', () => {
    test('should match snapshot, loaded without data', () => {
        const data: TableItem[] = [];

        const {container} = renderWithContext(
            <TableChart
                title='Test'
                data={data}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', () => {
        const data = [
            {name: 'test1', tip: 'test-tip1', value: <p>{'test-value1'}</p>},
            {name: 'test2', tip: 'test-tip2', value: <p>{'test-value2'}</p>},
        ];

        const {container} = renderWithContext(
            <TableChart
                title='Test'
                data={data}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
