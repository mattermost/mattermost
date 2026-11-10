// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, fireEvent, act} from 'tests/react_testing_utils';

import ClassificationColorInput from './classification_color_input';

function makeProps(overrides = {}) {
    return {
        id: 'test-color',
        value: '#FF0000',
        onChange: jest.fn(),
        swatchAriaLabel: 'Open color picker',
        ...overrides,
    };
}

describe('ClassificationColorInput', () => {
    test('renders hex input with initial value', () => {
        render(<ClassificationColorInput {...makeProps()}/>);
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#FF0000');
    });

    test('renders color swatch button with aria-label', () => {
        render(<ClassificationColorInput {...makeProps()}/>);
        expect(screen.getByRole('button', {name: 'Open color picker'})).toBeInTheDocument();
    });

    test('swatch button is not rendered when disabled', () => {
        render(<ClassificationColorInput {...makeProps({isDisabled: true})}/>);
        expect(screen.queryByRole('button', {name: 'Open color picker'})).not.toBeInTheDocument();
    });

    test('hex input is disabled when isDisabled is true', () => {
        render(<ClassificationColorInput {...makeProps({isDisabled: true})}/>);
        expect(screen.getByTestId('color-inputColorValue')).toBeDisabled();
    });

    test('calls onChange with normalized hex when valid color typed', () => {
        const onChange = jest.fn();
        render(<ClassificationColorInput {...makeProps({onChange})}/>);

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#00FF00'}});

        expect(onChange).toHaveBeenCalledWith('#00ff00');
    });

    test('does not call onChange when invalid color typed', () => {
        const onChange = jest.fn();
        render(<ClassificationColorInput {...makeProps({onChange})}/>);

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#GGGGGG'}});

        expect(onChange).not.toHaveBeenCalled();
    });

    test('local value reflects typing before blur', () => {
        render(<ClassificationColorInput {...makeProps()}/>);
        const input = screen.getByTestId('color-inputColorValue');

        fireEvent.change(input, {target: {value: '#1a2b3c'}});

        expect(input).toHaveValue('#1a2b3c');
    });

    test('normalizes and calls onChange on blur with valid color', () => {
        const onChange = jest.fn();
        render(<ClassificationColorInput {...makeProps({onChange})}/>);
        const input = screen.getByTestId('color-inputColorValue');

        fireEvent.focus(input);
        fireEvent.change(input, {target: {value: 'red'}});
        fireEvent.blur(input);

        expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    });

    test('reverts to original value on blur with invalid color', () => {
        render(<ClassificationColorInput {...makeProps({value: '#FF0000'})}/>);
        const input = screen.getByTestId('color-inputColorValue');

        fireEvent.focus(input);
        fireEvent.change(input, {target: {value: 'not-a-color'}});
        fireEvent.blur(input);

        expect(input).toHaveValue('#FF0000');
    });

    test('opens color picker popover when input is focused', () => {
        render(<ClassificationColorInput {...makeProps()}/>);
        const input = screen.getByTestId('color-inputColorValue');

        act(() => {
            fireEvent.focus(input);
        });

        expect(document.getElementById('test-color-ChromePickerModal')).toBeInTheDocument();
    });

    test('closes color picker popover on blur', () => {
        render(<ClassificationColorInput {...makeProps()}/>);
        const input = screen.getByTestId('color-inputColorValue');

        act(() => {
            fireEvent.focus(input);
        });
        expect(document.getElementById('test-color-ChromePickerModal')).toBeInTheDocument();

        act(() => {
            fireEvent.blur(input);
        });
        expect(document.getElementById('test-color-ChromePickerModal')).not.toBeInTheDocument();
    });

    test('syncs local value when external value changes while not focused', () => {
        const {rerender} = render(<ClassificationColorInput {...makeProps({value: '#FF0000'})}/>);

        rerender(<ClassificationColorInput {...makeProps({value: '#0000FF'})}/>);

        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#0000FF');
    });

    test('Enter key blurs the hex input', () => {
        render(<ClassificationColorInput {...makeProps()}/>);
        const input = screen.getByTestId('color-inputColorValue');
        const blurSpy = jest.spyOn(input, 'blur');

        fireEvent.keyDown(input, {key: 'Enter'});

        expect(blurSpy).toHaveBeenCalled();
    });
});
