// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {MaxLengthInput} from 'components/quick_input/index';

describe('components/MaxLengthInput', () => {
    const requiredProps = {
        className: 'input',
        maxLength: 20,
    };

    test.each([
        [undefined],
        ['less than 20'],
        ['Where is Jessica Hyde?'],
    ])('should match snapshot', (defaultValue) => {
        const wrapper = shallow(
            <MaxLengthInput
                {...requiredProps}
                defaultValue={defaultValue}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test.each([
        [undefined, false, false],
        ['less than 20', false, false],
        ['Where is Jessica Hyde?', true, true],
    ])('defaultValue: %s .has-error: %s, .MaxLengthInput__validation: %s', (defaultValue, hasError, maxLengthExists) => {
        const wrapper = shallow(
            <MaxLengthInput
                {...requiredProps}
                defaultValue={defaultValue}
            />,
        );

        expect(wrapper.find('input').hasClass('has-error')).toBe(hasError);
        expect(wrapper.exists('.MaxLengthInput__validation')).toBe(maxLengthExists);
    });

    test('should display the number of times value length exceeds maxLength', () => {
        const props = {
            defaultValue: 'Where is Jessica Hyde?',
            ...requiredProps,
        };

        const wrapper = shallow(
            <MaxLengthInput {...props}/>,
        );

        expect(wrapper.find('.MaxLengthInput__validation').text()).toBe('-2');
    });
});
