// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, fireEvent, screen} from 'tests/react_testing_utils';

import ColorInput from './color_input';

describe('components/ColorInput', () => {
    const baseProps = {
        id: 'sidebarBg',
        onChange: jest.fn(),
        value: '#ffffff',
    };

    test('should hide color picker when first rendered', () => {
        const {getByTestId} = renderWithContext(<ColorInput {...baseProps}/>);

        const inputElement = getByTestId('color-inputColorValue');

        expect(inputElement).toBeInTheDocument();
        expect(inputElement).toBeVisible();
        expect(screen.queryByTestId('color-popover')).not.toBeInTheDocument();
    });

    test('should toggle color picker when color picker button is clicked', () => {
        const {getByTestId} = renderWithContext(<ColorInput {...baseProps}/>);

        const colorPickerToggleButton = getByTestId('color-togglerButton');

        fireEvent.click(colorPickerToggleButton);

        const colorPopover = getByTestId('color-popover');

        expect(colorPopover).toBeInTheDocument();
        expect(colorPopover).toBeVisible();
        expect(document.activeElement).toBe(getByTestId('color-inputColorValue'));

        fireEvent.click(colorPickerToggleButton);

        expect(screen.queryByTestId('color-popover')).not.toBeInTheDocument();
    });

    test('should change color when the color picker is clicked', () => {
        const {getByTestId} = renderWithContext(<ColorInput {...baseProps}/>);

        fireEvent.click(getByTestId('color-togglerButton'));

        const colorPopover = getByTestId('color-popover');

        userEvent.click(colorPopover);

        expect(colorPopover).toBeInTheDocument();
        expect(baseProps.onChange).toHaveBeenCalledTimes(1);
    });

    test('should keep what the user types in the textbox until blur', () => {
        const {getByTestId} = renderWithContext(<ColorInput {...baseProps}/>);

        const inputElement = getByTestId('color-inputColorValue');

        inputElement.focus();

        expect(document.activeElement).toBe(inputElement);

        fireEvent.change(inputElement, {target: {value: '#abc'}});

        expect(inputElement).toHaveValue('#abc');
        expect(baseProps.onChange).toHaveBeenLastCalledWith('#aabbcc');

        // The RGB here is the equivalent of '#abc'.
        expect(getByTestId('color-icon').style.backgroundColor).toBe('rgb(170, 187, 204)');

        inputElement.blur();

        expect(document.activeElement).not.toBe(inputElement);
        expect(inputElement).toHaveValue('#ffffff');
        expect(baseProps.onChange).toHaveBeenLastCalledWith('#aabbcc');

        /**
         * The icon color is set back to the one provided in props (#ffffff) because the input isn't
         * focused anymore, and the props value is different from the state value. The RGB value passed
         * in the assertion is the equivalent of '#ffffff'.
         */
        expect(getByTestId('color-icon').style.backgroundColor).toBe('rgb(255, 255, 255)');
    });
});
