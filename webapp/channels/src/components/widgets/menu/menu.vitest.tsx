// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {fireEvent, renderWithIntl, screen} from 'tests/vitest_react_testing_utils';

import Menu from './menu';

vi.mock('./is_mobile_view_hack', () => ({
    isMobile: vi.fn(() => false),
}));

(global as any).MutationObserver = class {
    public disconnect() {}
    public observe() {}
};

describe('components/Menu', () => {
    test('should render with aria-label and default classes', () => {
        renderWithIntl(<Menu ariaLabel='test-label'>{'text'}</Menu>);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveClass('Menu__content', 'dropdown-menu');
        expect(menu).toHaveTextContent('text');

        const container = screen.getByLabelText('test-label');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('a11y__popup', 'Menu');
    });

    test('should render with custom id', () => {
        renderWithIntl(
            <Menu
                id='test-id'
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        const container = screen.getByLabelText('test-label');
        expect(container).toHaveAttribute('id', 'test-id');
        expect(container).toHaveClass('a11y__popup', 'Menu');

        const menu = screen.getByRole('menu');
        expect(menu).toHaveTextContent('text');
    });

    test('should apply openLeft and openUp classes', () => {
        renderWithIntl(
            <Menu
                openLeft={true}
                openUp={true}
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        const menu = screen.getByRole('menu');
        expect(menu).toHaveClass('Menu__content', 'dropdown-menu', 'openLeft', 'openUp');
        expect(menu).toHaveTextContent('text');
    });

    test('should apply custom styles to menu list', () => {
        const customStyles = {maxHeight: '200px', backgroundColor: 'red'};
        renderWithIntl(
            <Menu
                ariaLabel='test-label'
                customStyles={customStyles}
            >
                {'text'}
            </Menu>,
        );

        const menu = screen.getByRole('menu');
        expect(menu).toHaveStyle({maxHeight: '200px', backgroundColor: 'red'});
    });

    test('should apply custom className to menu list', () => {
        renderWithIntl(
            <Menu
                ariaLabel='test-label'
                className='custom-menu-class'
            >
                {'text'}
            </Menu>,
        );

        const menu = screen.getByRole('menu');
        expect(menu).toHaveClass('Menu__content', 'dropdown-menu', 'custom-menu-class');
    });

    test('should apply listId to menu list element', () => {
        renderWithIntl(
            <Menu
                ariaLabel='test-label'
                listId='custom-menu-list-id'
            >
                {'text'}
            </Menu>,
        );

        const menu = screen.getByRole('menu');
        expect(menu).toHaveAttribute('id', 'custom-menu-list-id');
    });

    test('should keep menu open when clicking empty space but allow closing from menu items', () => {
        const TestComponent = () => {
            const [isMenuOpen, setIsMenuOpen] = React.useState(true);

            return (
                <div>
                    {isMenuOpen && (
                        <div
                            onClick={() => setIsMenuOpen(false)}
                            data-testid='backdrop'
                        >
                            <Menu ariaLabel='test-label'>
                                <button
                                    className='menu-item'
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {'Close Menu'}
                                </button>
                            </Menu>
                        </div>
                    )}
                    {!isMenuOpen && <div data-testid='menu-closed'>{'Menu Closed'}</div>}
                </div>
            );
        };

        renderWithIntl(<TestComponent/>);

        // Menu should be initially open
        let menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(screen.queryByTestId('menu-closed')).not.toBeInTheDocument();

        // Clicking empty space in menu should NOT close it
        fireEvent.click(menu);
        menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(screen.queryByTestId('menu-closed')).not.toBeInTheDocument();

        // But clicking a menu item SHOULD close it (event bubbles normally)
        const menuItem = screen.getByRole('button', {name: 'Close Menu'});
        fireEvent.click(menuItem);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByTestId('menu-closed')).toBeInTheDocument();
    });
});
