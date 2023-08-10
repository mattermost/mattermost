// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TableChart from 'components/analytics/table_chart';

import type {TableItem} from 'components/analytics/table_chart';

describe('components/analytics/table_chart.tsx', () => {
    test('should match snapshot, loaded without data', () => {
        const data: TableItem[] = [];

        const wrapper = shallow(
            <TableChart
                title='Test'
                data={data}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', () => {
        const data = [
            {name: 'test1', tip: 'test-tip1', value: <p>{'test-value1'}</p>},
            {name: 'test2', tip: 'test-tip2', value: <p>{'test-value2'}</p>},
        ];

        const wrapper = shallow(
            <TableChart
                title='Test'
                data={data}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
