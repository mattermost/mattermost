// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import CircularChart from './circular_chart';

describe('/components/common/CircularChart', () => {
    const baseProps = {
        value: 75,
        isPercentage: false,
        width: 100,
        height: 100,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <CircularChart
                {...baseProps}
                type={'success'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('test circularChart contains the text value as specified in the base props', () => {
        const {container} = renderWithContext(
            <CircularChart
                {...baseProps}
                type={'success'}
            />,
        );
        const circularChartText = container.querySelector('.percentageOrNumber');

        expect(parseInt(circularChartText?.textContent || '0', 10)).toBe(baseProps.value);
    });

    test('test circularChart contains the text value with the percentage symbol when isPercentage is set to true', () => {
        renderWithContext(
            <CircularChart
                {...{...baseProps, isPercentage: true}}
                type={'success'}
            />,
        );
        const circularChartText = screen.getByText(`${baseProps.value.toString()} %`);

        expect(circularChartText).toBeInTheDocument();
    });
});
