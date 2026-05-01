// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import CircularChart from './circular_chart';

describe('/components/common/CircularChart', () => {
    const baseProps = {
        value: 75,
        isPercentage: false,
        width: 100,
        height: 100,
    };

    test('should match snapshot', () => {
        const {container} = render(
            <CircularChart
                {...baseProps}
                type={'success'}
            />);
        expect(container).toMatchSnapshot();
    });

    test('test circularChart contains the text value as specified in the base props', () => {
        render(
            <CircularChart
                {...baseProps}
                type={'success'}
            />);
        const circularChartText = screen.getByText('75');

        expect(circularChartText).toBeInTheDocument();
    });

    test('test circularChart contains the text value with the percentage symbol when isPercentage is set to true', () => {
        render(
            <CircularChart
                {...{...baseProps, isPercentage: true}}
                type={'success'}
            />);
        const circularChartText = screen.getByText('75 %');

        expect(circularChartText).toBeInTheDocument();
    });
});
