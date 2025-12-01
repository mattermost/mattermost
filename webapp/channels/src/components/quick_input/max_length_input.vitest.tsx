// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {MaxLengthInput} from 'components/quick_input/index';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

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
        const {container} = renderWithContext(
            <MaxLengthInput
                {...requiredProps}
                defaultValue={defaultValue}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test.each([
        [undefined, false, false],
        ['less than 20', false, false],
        ['Where is Jessica Hyde?', true, true],
    ])('defaultValue: %s .has-error: %s, .MaxLengthInput__validation: %s', (defaultValue, hasError, maxLengthExists) => {
        const {container} = renderWithContext(
            <MaxLengthInput
                {...requiredProps}
                defaultValue={defaultValue}
            />,
        );

        const input = container.querySelector('input');
        expect(input?.classList.contains('has-error')).toBe(hasError);
        expect(container.querySelector('.MaxLengthInput__validation') !== null).toBe(maxLengthExists);
    });

    test('should display the number of times value length exceeds maxLength', () => {
        const props = {
            defaultValue: 'Where is Jessica Hyde?',
            ...requiredProps,
        };

        renderWithContext(
            <MaxLengthInput {...props}/>,
        );

        expect(screen.getByText('-2')).toBeInTheDocument();
    });
});
