// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, fireEvent} from 'tests/react_testing_utils';

import ColorInput from './color_input';

describe('components/ColorInput', () => {
    const baseProps = {
        id: 'sidebarBg',
        onChange: jest.fn(),
        value: '#ffffff',
    };

    test('should match snapshot, init', () => {
        const {container} = render(
            <ColorInput {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, opened', () => {
        const {container} = render(
            <ColorInput {...baseProps}/>,
        );

        fireEvent.click(container.querySelector('.input-group-addon')!);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, toggle picker', () => {
        const {container} = render(
            <ColorInput {...baseProps}/>,
        );
        fireEvent.click(container.querySelector('.input-group-addon')!);
        fireEvent.click(container.querySelector('.input-group-addon')!);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, click on picker', () => {
        const {container} = render(
            <ColorInput {...baseProps}/>,
        );

        fireEvent.click(container.querySelector('.input-group-addon')!);
        fireEvent.click(container.querySelector('.color-popover')!);

        expect(container).toMatchSnapshot();
    });

    test('should have match state on togglePicker', () => {
        const {container} = render(
            <ColorInput {...baseProps}/>,
        );

        // Initially picker should be closed (no color-popover)
        expect(container.querySelector('.color-popover')).not.toBeInTheDocument();

        // Click to open
        fireEvent.click(container.querySelector('.input-group-addon')!);
        expect(container.querySelector('.color-popover')).toBeInTheDocument();

        // Click to close
        fireEvent.click(container.querySelector('.input-group-addon')!);
        expect(container.querySelector('.color-popover')).not.toBeInTheDocument();

        // Click to open again
        fireEvent.click(container.querySelector('.input-group-addon')!);
        expect(container.querySelector('.color-popover')).toBeInTheDocument();
    });

    test('should keep what the user types in the textbox until blur', () => {
        let currentValue = '#ffffff';
        const onChange = jest.fn((value: string) => {
            currentValue = value;
        });

        const {container, rerender} = render(
            <ColorInput
                {...baseProps}
                value={currentValue}
                onChange={onChange}
            />,
        );

        const input = screen.getByRole('textbox');
        const colorIcon = container.querySelector('.color-icon') as HTMLElement;

        fireEvent.focus(input);

        fireEvent.change(input, {target: {value: '#abc'}});
        expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
        expect(input).toHaveValue('#abc');
        expect(colorIcon.style.backgroundColor).toBe('rgb(170, 187, 204)');

        // Rerender with updated value prop (simulating parent component update)
        rerender(
            <ColorInput
                {...baseProps}
                value={currentValue}
                onChange={onChange}
            />,
        );

        fireEvent.blur(input);

        // After blur, the input should show the normalized value
        expect(input).toHaveValue('#aabbcc');
        expect(colorIcon.style.backgroundColor).toBe('rgb(170, 187, 204)');
    });
});
