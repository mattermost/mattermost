// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, fireEvent, render, userEvent} from 'tests/vitest_react_testing_utils';

import MenuWrapper from './menu_wrapper';

describe('components/MenuWrapper', () => {
    test('should render in closed state by default', () => {
        const {container} = render(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        expect(wrapper).toBeInTheDocument();
        expect(wrapper).not.toHaveClass('MenuWrapper--open');
        expect(container).toHaveTextContent('title');
    });

    test('should add open class when clicked', async () => {
        const {container} = render(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        expect(wrapper).not.toHaveClass('MenuWrapper--open');

        // Click to open
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await userEvent.click(wrapper!);

        expect(wrapper).toHaveClass('MenuWrapper--open');
    });

    test('should toggle between open and closed on multiple clicks', async () => {
        const {container} = render(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');

        // Initially closed
        expect(wrapper).not.toHaveClass('MenuWrapper--open');

        // Click to open
        if (wrapper) {
            await userEvent.click(wrapper);
        }
        expect(wrapper).toHaveClass('MenuWrapper--open');

        // Click to close
        if (wrapper) {
            await userEvent.click(wrapper);
        }
        expect(wrapper).not.toHaveClass('MenuWrapper--open');
    });

    test('should raise an exception on more or less than 2 children', () => {
        // Suppress all error output (React console.error + jsdom stderr)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const originalStderrWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = vi.fn() as typeof process.stderr.write;

        expect(() => {
            render(<MenuWrapper/>);
        }).toThrow();
        expect(() => {
            render(
                <MenuWrapper>
                    <p>{'title'}</p>
                </MenuWrapper>,
            );
        }).toThrow();
        expect(() => {
            render(
                <MenuWrapper>
                    <p>{'title1'}</p>
                    <p>{'title2'}</p>
                    <p>{'title3'}</p>
                </MenuWrapper>,
            );
        }).toThrow();

        // Restore
        consoleSpy.mockRestore();
        process.stderr.write = originalStderrWrite;
    });

    test('should stop propagation and prevent default when toggled and prop is enabled', () => {
        const {container} = render(
            <MenuWrapper stopPropagationOnToggle={true}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        const mockEvent = new MouseEvent('click', {bubbles: true, cancelable: true});
        const preventDefault = vi.spyOn(mockEvent, 'preventDefault');
        const stopPropagation = vi.spyOn(mockEvent, 'stopPropagation');

        act(() => {
            wrapper?.dispatchEvent(mockEvent);
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();
    });

    test('should call the onToggle callback when toggled', async () => {
        const onToggle = vi.fn();
        const {container} = render(
            <MenuWrapper onToggle={onToggle}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        if (wrapper) {
            await userEvent.click(wrapper);
        }

        expect(onToggle).toHaveBeenCalledWith(true);
    });

    test('should render in open state when open prop is true', () => {
        const {container} = render(
            <MenuWrapper open={true}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        expect(wrapper).toHaveClass('MenuWrapper--open');
    });

    test('should close menu when ESC key is pressed', async () => {
        const {container} = render(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');

        // Open the menu
        if (wrapper) {
            await userEvent.click(wrapper);
        }
        expect(wrapper).toHaveClass('MenuWrapper--open');

        // Press ESC key
        fireEvent.keyUp(document, {key: 'Escape', code: 'Escape'});

        // Menu should be closed
        expect(wrapper).not.toHaveClass('MenuWrapper--open');
    });

    test('should close menu on TAB key when focus leaves menu', async () => {
        const {container} = render(
            <div>
                <MenuWrapper>
                    <button>{'title'}</button>
                    <div>
                        <button>{'menu item'}</button>
                    </div>
                </MenuWrapper>
                <button>{'outside'}</button>
            </div>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        const titleButton = container.querySelector('button');

        // Open the menu
        if (titleButton) {
            await userEvent.click(titleButton);
        }
        expect(wrapper).toHaveClass('MenuWrapper--open');

        // Simulate TAB key to an element outside the menu
        const outsideButton = container.querySelectorAll('button')[2];
        fireEvent.keyUp(outsideButton, {key: 'Tab', code: 'Tab'});

        // Menu should be closed
        expect(wrapper).not.toHaveClass('MenuWrapper--open');
    });

    test('should not close menu on TAB if focus stays within menu', async () => {
        const {container} = render(
            <MenuWrapper>
                <button>{'title'}</button>
                <div>
                    <button>{'menu item'}</button>
                </div>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');
        const titleButton = container.querySelector('button');

        // Open the menu
        if (titleButton) {
            await userEvent.click(titleButton);
        }
        expect(wrapper).toHaveClass('MenuWrapper--open');

        // Simulate TAB key within the menu
        const menuButton = container.querySelectorAll('button')[1];
        fireEvent.keyUp(menuButton, {key: 'Tab', code: 'Tab'});

        // Menu should still be open
        expect(wrapper).toHaveClass('MenuWrapper--open');
    });

    test('should call onToggle with false when closing via ESC key', async () => {
        const onToggle = vi.fn();
        const {container} = render(
            <MenuWrapper onToggle={onToggle}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');

        // Open the menu
        if (wrapper) {
            await userEvent.click(wrapper);
        }
        expect(onToggle).toHaveBeenCalledWith(true);

        // Clear mock calls
        onToggle.mockClear();

        // Press ESC key
        fireEvent.keyUp(document, {key: 'Escape', code: 'Escape'});

        // onToggle should be called with false
        expect(onToggle).toHaveBeenCalledWith(false);
    });

    test('should not call onToggle when menu is already closed', async () => {
        const onToggle = vi.fn();
        const {container} = render(
            <MenuWrapper onToggle={onToggle}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');

        // Menu is closed by default, press ESC
        fireEvent.keyUp(document, {key: 'Escape', code: 'Escape'});

        // onToggle should not be called since menu was already closed
        expect(onToggle).not.toHaveBeenCalled();

        // Verify menu is still closed
        expect(wrapper).not.toHaveClass('MenuWrapper--open');
    });
});
