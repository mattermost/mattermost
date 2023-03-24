// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {mount} from 'enzyme';

import ProgressBar from 'components/progress_bar';

describe('components/progress_bar', () => {
    test('should show no progress', () => {
        const props = {
            current: 0,
            total: 10,
        };
        const wrapper = mount(
            <ProgressBar {...props}/>,
        );

        expect(wrapper.find('.ProgressBar__progress').prop('style')).toHaveProperty('flexGrow', 0);
    });

    test('should show 50% progress', () => {
        const props = {
            current: 5,
            total: 10,
        };
        const wrapper = mount(
            <ProgressBar {...props}/>,
        );

        expect(wrapper.find('.ProgressBar__progress').prop('style')).toHaveProperty('flexGrow', 0.5);
    });

    test('should show full progress', () => {
        const props = {
            current: 7,
            total: 7,
        };
        const wrapper = mount(
            <ProgressBar {...props}/>,
        );

        expect(wrapper.find('.ProgressBar__progress').prop('style')).toHaveProperty('flexGrow', 1);
    });

    test('should have flex basis', () => {
        const props = {
            current: 0,
            total: 7,
            basePercentage: 10,
        };
        const wrapper = mount(
            <ProgressBar {...props}/>,
        );

        expect(wrapper.find('.ProgressBar__progress').prop('style')).toHaveProperty('flexBasis', '10%');
    });
});
