// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import ColorInput from './color_input';

describe('components/ColorInput', () => {
    const baseProps = {
        id: 'sidebarBg',
        onChange: vi.fn(),
        value: '#ffffff',
    };

    test('should match snapshot, init', () => {
        const {container} = renderWithContext(<ColorInput {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, opened', () => {
        const {container} = renderWithContext(<ColorInput {...baseProps}/>);

        const addon = container.querySelector('.input-group-addon');
        fireEvent.click(addon!);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, toggle picker', () => {
        const {container} = renderWithContext(<ColorInput {...baseProps}/>);

        const addon = container.querySelector('.input-group-addon');

        // First click - open
        fireEvent.click(addon!);

        // Second click - close
        fireEvent.click(addon!);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, click on picker', () => {
        const {container} = renderWithContext(<ColorInput {...baseProps}/>);

        const addon = container.querySelector('.input-group-addon');
        fireEvent.click(addon!);

        const colorPopover = container.querySelector('.color-popover');
        fireEvent.click(colorPopover!);

        expect(container).toMatchSnapshot();
    });

    test('should have match state on togglePicker', () => {
        const {container} = renderWithContext(<ColorInput {...baseProps}/>);

        const addon = container.querySelector('.input-group-addon');

        // Click to open
        fireEvent.click(addon!);
        expect(container.querySelector('.color-popover')).toBeInTheDocument();

        // Click to close
        fireEvent.click(addon!);
        expect(container.querySelector('.color-popover')).not.toBeInTheDocument();

        // Click to open again
        fireEvent.click(addon!);
        expect(container.querySelector('.color-popover')).toBeInTheDocument();
    });

    test('should keep what the user types in the textbox until blur', () => {
        const onChange = vi.fn();
        const {rerender} = renderWithContext(
            <ColorInput
                {...baseProps}
                onChange={onChange}
            />,
        );

        const input = screen.getByRole('textbox');

        fireEvent.focus(input);
        fireEvent.change(input, {target: {value: '#abc'}});

        // onChange should be called with expanded color
        expect(onChange).toHaveBeenCalledWith('#aabbcc');

        // Simulate prop update from onChange
        rerender(
            <ColorInput
                {...baseProps}
                value='#aabbcc'
                onChange={onChange}
            />,
        );

        fireEvent.blur(input);

        // After blur, input should show expanded value
        expect(screen.getByRole('textbox')).toHaveValue('#aabbcc');
    });
});
