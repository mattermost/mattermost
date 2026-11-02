// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import CheckboxSettingItem from './checkbox_setting_item';

describe('components/widgets/modals/components/CheckboxSettingItem', () => {
    const baseProps = {
        title: 'Setting title',
        inputFieldTitle: 'Enable feature',
        inputFieldData: {
            name: 'enable feature',
            dataTestId: 'enable-feature-checkbox',
        },
        inputFieldValue: false,
        handleChange: jest.fn(),
    };

    test('should render Compass Checkbox with space-replaced id, name, and checked state', () => {
        const {container} = renderWithContext(
            <CheckboxSettingItem
                {...baseProps}
                inputFieldValue={true}
            />,
        );

        const checkbox = screen.getByRole('checkbox', {name: 'Enable feature'}) as HTMLInputElement;
        expect(checkbox).toBeVisible();
        expect(checkbox).toBeChecked();
        expect(checkbox).toHaveAttribute('id', 'enable-feature');
        expect(checkbox).toHaveAttribute('name', 'enable feature');
        expect(checkbox).toHaveAttribute('data-testid', 'enable-feature-checkbox');
        expect(container.querySelector('.mm-modal-generic-section-item__fieldset-checkbox')).toBeInTheDocument();
        expect(container.querySelector('.mm-modal-generic-section-item__input-checkbox')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should call handleChange with the boolean checked state', async () => {
        const handleChange = jest.fn();
        renderWithContext(
            <CheckboxSettingItem
                {...baseProps}
                handleChange={handleChange}
            />,
        );

        const checkbox = screen.getByRole('checkbox', {name: 'Enable feature'});
        expect(checkbox).not.toBeChecked();

        await userEvent.click(checkbox);

        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenCalledWith(true);
    });
});
