// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import Menu from './menu';

jest.mock('./is_mobile_view_hack', () => ({
    isMobile: jest.fn(() => false),
}));

(global as any).MutationObserver = class {
    public disconnect() {}
    public observe() {}
};

describe('components/Menu', () => {
    test('should render with aria-label and default classes', () => {
        render(<Menu ariaLabel='test-label'>{'text'}</Menu>);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveClass('Menu__content', 'dropdown-menu');
        expect(menu).toHaveTextContent('text');

        const container = screen.getByLabelText('test-label');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('a11y__popup', 'Menu');
    });

    test('should render with custom id', () => {
        render(
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
        render(
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
        render(
            <Menu
                ariaLabel='test-label'
                customStyles={customStyles}
            >
                {'text'}
            </Menu>,
        );

        const menu = screen.getByRole('menu');

        expect(menu.style.maxHeight).toBe('200px');
        expect(menu.style.backgroundColor).toBe('red');
    });

    test('should apply custom className to menu list', () => {
        render(
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
        render(
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

    test('should hide the correct dividers', () => {
        const {container} = render(
            <Menu ariaLabel='test-label'>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-item'>{'Item 1'}</div>
                <div className='menu-item'>{'Item 2'}</div>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-item'>{'Item 3'}</div>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-item'>{'Item 4'}</div>
                <div className='menu-item'>{'Item 5'}</div>
                <div className='menu-item'>{'Item 6'}</div>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
                <div className='menu-divider'/>
            </Menu>,
        );

        const dividers = container.querySelectorAll('.menu-divider');

        // First 4 dividers at the beginning should be hidden
        expect(dividers[0]).toHaveStyle({display: 'none'});
        expect(dividers[1]).toHaveStyle({display: 'none'});
        expect(dividers[2]).toHaveStyle({display: 'none'});
        expect(dividers[3]).toHaveStyle({display: 'none'});

        // Divider between items should be visible
        expect(dividers[4]).toHaveStyle({display: 'block'});

        // Consecutive divider should be hidden
        expect(dividers[5]).toHaveStyle({display: 'none'});

        // Divider between items should be visible
        expect(dividers[6]).toHaveStyle({display: 'block'});

        // Consecutive dividers should be hidden
        expect(dividers[7]).toHaveStyle({display: 'none'});
        expect(dividers[8]).toHaveStyle({display: 'none'});

        // Last 4 trailing dividers should be hidden
        expect(dividers[9]).toHaveStyle({display: 'none'});
        expect(dividers[10]).toHaveStyle({display: 'none'});
        expect(dividers[11]).toHaveStyle({display: 'none'});
        expect(dividers[12]).toHaveStyle({display: 'none'});
    });

    test('should hide the correct dividers on mobile', () => {
        const {container} = render(
            <Menu ariaLabel='test-label'>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='menu-item'>{'Item 1'}</div>
                <div className='menu-item'>{'Item 2'}</div>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='menu-item'>{'Item 3'}</div>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='menu-item'>{'Item 4'}</div>
                <div className='menu-item'>{'Item 5'}</div>
                <div className='menu-item'>{'Item 6'}</div>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
                <div className='mobile-menu-divider'/>
            </Menu>,
        );

        const dividers = container.querySelectorAll('.mobile-menu-divider');

        // First 4 dividers at the beginning should be hidden
        expect(dividers[0]).toHaveStyle({display: 'none'});
        expect(dividers[1]).toHaveStyle({display: 'none'});
        expect(dividers[2]).toHaveStyle({display: 'none'});
        expect(dividers[3]).toHaveStyle({display: 'none'});

        // Divider between items should be visible
        expect(dividers[4]).toHaveStyle({display: 'block'});

        // Consecutive divider should be hidden
        expect(dividers[5]).toHaveStyle({display: 'none'});

        // Divider between items should be visible
        expect(dividers[6]).toHaveStyle({display: 'block'});

        // Consecutive dividers should be hidden
        expect(dividers[7]).toHaveStyle({display: 'none'});
        expect(dividers[8]).toHaveStyle({display: 'none'});

        // Last 4 trailing dividers should be hidden
        expect(dividers[9]).toHaveStyle({display: 'none'});
        expect(dividers[10]).toHaveStyle({display: 'none'});
        expect(dividers[11]).toHaveStyle({display: 'none'});
        expect(dividers[12]).toHaveStyle({display: 'none'});
    });

    test('should update divider visibility on children change', () => {
        const {container, rerender} = render(
            <Menu ariaLabel='test-label'>
                <div className='menu-divider'/>
                <div className='menu-item'>{'Item 1'}</div>
            </Menu>,
        );

        let dividers = container.querySelectorAll('.menu-divider');
        expect(dividers[0]).toHaveStyle({display: 'none'});

        // Rerender with divider between items
        rerender(
            <Menu ariaLabel='test-label'>
                <div className='menu-item'>{'Item 1'}</div>
                <div className='menu-divider'/>
                <div className='menu-item'>{'Item 2'}</div>
            </Menu>,
        );

        dividers = container.querySelectorAll('.menu-divider');
        expect(dividers[0]).toHaveStyle({display: 'block'});
    });

    test('should keep menu open when clicking empty space but allow closing from menu items', async () => {
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

        render(<TestComponent/>);

        // Menu should be initially open
        let menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(screen.queryByTestId('menu-closed')).not.toBeInTheDocument();

        // Clicking empty space in menu should NOT close it
        await userEvent.click(menu);
        menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(screen.queryByTestId('menu-closed')).not.toBeInTheDocument();

        // But clicking a menu item SHOULD close it (event bubbles normally)
        const menuItem = screen.getByRole('button', {name: 'Close Menu'});
        await userEvent.click(menuItem);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByTestId('menu-closed')).toBeInTheDocument();
    });

    test('should return bounding rectangle from rect() method', () => {
        const ref = React.createRef<Menu>();
        render(
            <Menu
                ref={ref}
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        // Mock getBoundingClientRect
        const mockRect = {
            x: 10,
            y: 20,
            width: 100,
            height: 200,
            top: 20,
            left: 10,
            bottom: 220,
            right: 110,
            toJSON: () => ({}),
        };

        if (ref.current?.node.current) {
            ref.current.node.current.getBoundingClientRect = jest.fn(() => mockRect);
        }

        const rect = ref.current?.rect();
        expect(rect).toEqual(mockRect);
    });

    test('should return null from rect() when node is not available', () => {
        const ref = React.createRef<Menu>();
        render(
            <Menu
                ref={ref}
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        // Override the node ref to be null
        if (ref.current) {
            Object.defineProperty(ref.current, 'node', {
                value: {current: null},
                writable: true,
            });
        }

        const rect = ref.current?.rect();
        expect(rect).toBeNull();
    });
});
