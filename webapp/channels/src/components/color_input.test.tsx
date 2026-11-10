// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import {renderWithContext, userEvent, screen, act} from 'tests/react_testing_utils';

import ColorInput, {type ColorInputProps} from './color_input';

function ColorInputWrapper({onChange, value: initialValue, ...otherProps}: ColorInputProps) {
    const [value, setValue] = useState(initialValue);

    const handleChange = useCallback((value: string) => {
        setValue(value);
        onChange(value);
    }, [onChange]);

    return (
        <ColorInput
            value={value}
            onChange={handleChange}
            {...otherProps}
        />
    );
}

describe('components/ColorInput', () => {
    const baseProps = {
        id: 'sidebarBg',
        onChange: jest.fn(),
        value: '#ffffff',
    };

    test('should hide color picker when first rendered', () => {
        const {getByTestId} = renderWithContext(<ColorInputWrapper {...baseProps}/>);

        const inputElement = getByTestId('color-inputColorValue');

        expect(inputElement).toBeInTheDocument();
        expect(inputElement).toBeVisible();
        expect(screen.queryByTestId('color-popover')).not.toBeInTheDocument();
    });

    test('should show color picker when color picker button is clicked', async () => {
        const {getByTestId} = renderWithContext(<ColorInputWrapper {...baseProps}/>);

        const colorPickerToggleButton = getByTestId('color-togglerButton');

        await userEvent.click(colorPickerToggleButton);

        const colorPopover = getByTestId('color-popover');

        expect(colorPopover).toBeInTheDocument();
        expect(colorPopover).toBeVisible();
        expect(document.activeElement).toBe(getByTestId('color-inputColorValue'));

        await userEvent.click(document.body);

        expect(screen.queryByTestId('color-popover')).not.toBeInTheDocument();
    });

    test('should change color when the color picker is clicked', async () => {
        const {getByTestId} = renderWithContext(<ColorInputWrapper {...baseProps}/>);

        await userEvent.click(getByTestId('color-togglerButton'));

        const colorPopover = getByTestId('color-popover');

        await userEvent.click(colorPopover);

        expect(colorPopover).toBeInTheDocument();
        expect(baseProps.onChange).toHaveBeenCalledTimes(1);
    });

    test('should keep what the user types in the textbox until blur', async () => {
        const {getByTestId} = renderWithContext(<ColorInputWrapper{...baseProps}/>);

        const inputElement = getByTestId('color-inputColorValue');

        await userEvent.clear(inputElement);
        await userEvent.type(inputElement, '#abc');

        expect(inputElement).toHaveValue('#abc');

        // The RGB here is the equivalent of '#abc'.
        expect(getByTestId('color-icon').style.backgroundColor).toBe('rgb(170, 187, 204)');

        await act(() => {
            inputElement.blur();
        });

        expect(document.activeElement).not.toBe(inputElement);
        expect(inputElement).toHaveValue('#aabbcc');

        // The RGB value passed in the assertion is the equivalent of '#aabbcc'.
        expect(getByTestId('color-icon').style.backgroundColor).toBe('rgb(170, 187, 204)');
    });
});
