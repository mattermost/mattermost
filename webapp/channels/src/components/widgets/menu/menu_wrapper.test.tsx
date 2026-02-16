// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, render, userEvent} from 'tests/react_testing_utils';

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
        // Suppress console.error for these expected errors
        const originalError = console.error;
        console.error = jest.fn();

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

        console.error = originalError;
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
        const preventDefault = jest.spyOn(mockEvent, 'preventDefault');
        const stopPropagation = jest.spyOn(mockEvent, 'stopPropagation');

        wrapper?.dispatchEvent(mockEvent);

        expect(preventDefault).toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();
    });

    test('should call the onToggle callback when toggled', async () => {
        const onToggle = jest.fn();
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
        // fireEvent on document used because userEvent.keyboard requires element focus
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

        // fireEvent on document used because userEvent.keyboard requires element focus
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

        // fireEvent on document used because userEvent.keyboard requires element focus
        fireEvent.keyUp(menuButton, {key: 'Tab', code: 'Tab'});

        // Menu should still be open
        expect(wrapper).toHaveClass('MenuWrapper--open');
    });

    test('should call onToggle with false when closing via ESC key', async () => {
        const onToggle = jest.fn();
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
        // fireEvent on document used because userEvent.keyboard requires element focus
        fireEvent.keyUp(document, {key: 'Escape', code: 'Escape'});

        // onToggle should be called with false
        expect(onToggle).toHaveBeenCalledWith(false);
    });

    test('should not call onToggle when menu is already closed', async () => {
        const onToggle = jest.fn();
        const {container} = render(
            <MenuWrapper onToggle={onToggle}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        const wrapper = container.querySelector('.MenuWrapper');

        // Menu is closed by default, press ESC
        // fireEvent on document used because userEvent.keyboard requires element focus
        fireEvent.keyUp(document, {key: 'Escape', code: 'Escape'});

        // onToggle should not be called since menu was already closed
        expect(onToggle).not.toHaveBeenCalled();

        // Verify menu is still closed
        expect(wrapper).not.toHaveClass('MenuWrapper--open');
    });
});
