// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import DropdownInput from './dropdown_input';

const options = [
    {label: 'First', value: 'first'},
    {label: 'Second', value: 'second'},
];

describe('components/DropdownInput', () => {
    test('should name the open menu after the testId', async () => {
        renderWithContext(
            <DropdownInput
                name='level'
                testId='test_form.level'
                options={options}
                onChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('combobox'));

        expect(screen.getByTestId('test_form.level.menu')).toHaveTextContent('First');
        expect(screen.queryByTestId('dropdownMenu')).not.toBeInTheDocument();
    });

    test('should render the menu without a test id when no testId is given', async () => {
        renderWithContext(
            <DropdownInput
                name='level'
                options={options}
                onChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('combobox'));

        expect(screen.getByRole('listbox')).toHaveTextContent('Second');
        expect(screen.queryByTestId('dropdownMenu')).not.toBeInTheDocument();
    });
});
