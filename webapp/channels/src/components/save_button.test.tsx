// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SaveButton from 'components/save_button';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen} from 'tests/react_testing_utils';

describe('components/SaveButton', () => {
    const baseProps = {
        saving: false,
    };

    test('should render with default message', () => {
        render(withIntl(<SaveButton {...baseProps}/>));

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Save');
        expect(button).not.toBeDisabled();
    });

    test('should render with custom defaultMessage', () => {
        render(withIntl(
            <SaveButton
                {...baseProps}
                defaultMessage='Go'
            />,
        ));

        const button = screen.getByRole('button');
        expect(button).toHaveTextContent('Go');
        expect(button).not.toBeDisabled();
    });

    test('should render with saving state', () => {
        const props = {...baseProps, saving: true, disabled: true};
        render(withIntl(<SaveButton {...props}/>));

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Saving');
    });

    test('should render with custom savingMessage', () => {
        const props = {...baseProps, saving: true, disabled: true};
        render(withIntl(
            <SaveButton
                {...props}
                savingMessage='Saving Config...'
            />,
        ));

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Saving Config...');
    });

    test('should apply extraClasses', () => {
        const props = {...baseProps, extraClasses: 'some-class'};
        render(withIntl(<SaveButton {...props}/>));

        const button = screen.getByRole('button');
        expect(button).toHaveClass('some-class');
    });
});
