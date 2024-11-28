// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

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
    ])('should render with defaultValue: %s', (defaultValue) => {
        render(
            <MaxLengthInput
                {...requiredProps}
                defaultValue={defaultValue}
            />,
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue(defaultValue || '');
    });

    test.each([
        [undefined, false, false],
        ['less than 20', false, false],
        ['Where is Jessica Hyde?', true, true],
    ])('defaultValue: %s .has-error: %s, .MaxLengthInput__validation: %s', (defaultValue, hasError, maxLengthExists) => {
        render(
            <MaxLengthInput
                {...requiredProps}
                defaultValue={defaultValue}
            />,
        );

        const input = screen.getByRole('textbox');
        expect(input).toHaveClass('MaxLengthInput', 'input');
        if (hasError) {
            expect(input).toHaveClass('has-error');
        }

        const validation = screen.queryByText('-2');
        if (maxLengthExists) {
            expect(validation).toBeInTheDocument();
            expect(validation).toHaveClass('MaxLengthInput__validation');
        } else {
            expect(validation).not.toBeInTheDocument();
        }
    });

    test('should display the number of times value length exceeds maxLength', () => {
        const props = {
            defaultValue: 'Where is Jessica Hyde?',
            ...requiredProps,
        };

        render(<MaxLengthInput {...props}/>);

        const validation = screen.getByText('-2');
        expect(validation).toBeInTheDocument();
        expect(validation).toHaveClass('MaxLengthInput__validation');
    });
});
