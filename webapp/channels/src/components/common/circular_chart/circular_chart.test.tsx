// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import CircularChart from 'components/common/circular_chart/circular_chart';

// import {mountWithIntl} from 'tests/helpers/intl-test-helper';

describe('/components/common/CircularChart', () => {
    const baseProps = {
        value: 75,
        isPercentage: false,
        width: 100,
        height: 100,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <CircularChart
                {...baseProps}
                type={'success'}
            />);
        expect(wrapper).toMatchSnapshot();
    });

    test('test circularChart contains the text value as specified in the base props', () => {
        const wrapper = shallow(
            <CircularChart
                {...baseProps}
                type={'success'}
            />);
        const circularChartText = wrapper.find('.percentageOrNumber').text();

        expect(parseInt(circularChartText, 10)).toBe(baseProps.value);
    });

    test('test circularChart contains the text value with the percentage symbol when isPercentage is set to true', () => {
        const wrapper = shallow(
            <CircularChart
                {...{...baseProps, isPercentage: true}}
                type={'success'}
            />);
        const circularChartText = wrapper.find('.percentageOrNumber').text();

        expect(circularChartText).toBe(`${baseProps.value.toString()} %`);
    });
});
