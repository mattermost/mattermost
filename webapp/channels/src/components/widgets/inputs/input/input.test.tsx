// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import WithTooltip from 'components/with_tooltip';

import Input from './input';

describe('components/widgets/inputs/Input', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <Input/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should render with clearable enabled', () => {
        const value = 'value';
        const clearableTooltipText = 'tooltip text';
        const onClear = jest.fn();

        const wrapper = shallow(
            <Input
                value={value}
                clearable={true}
                clearableTooltipText={clearableTooltipText}
                onClear={onClear}
            />,
        );

        const clear = wrapper.find('.Input__clear');
        expect(clear.length).toEqual(1);
        expect(wrapper.find('CloseCircleIcon').length).toEqual(1);

        const tooltip = wrapper.find(WithTooltip);
        expect(tooltip.length).toEqual(1);

        const titleProp = tooltip.prop('title');
        expect(titleProp).toEqual(clearableTooltipText);

        clear.first().simulate('mousedown');

        expect(onClear).toHaveBeenCalledTimes(1);
    });
});
