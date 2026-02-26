// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CheckAllIcon, RefreshIcon} from '@mattermost/compass-icons/components';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import RecapMenu from './recap_menu';
import type {RecapMenuAction} from './recap_menu';

jest.mock('components/menu', () => ({
    Container: ({children, menuButton}: any) => {
        const {class: className, ...buttonProps} = menuButton;
        return (
            <div data-testid='menu-container'>
                <button
                    {...buttonProps}
                    className={className}
                    data-testid='menu-button'
                >
                    {menuButton.children}
                </button>
                {children}
            </div>
        );
    },
    Item: ({leadingElement, labels, onClick, disabled}: any) => (
        <button
            data-testid='menu-item'
            onClick={onClick}
            disabled={disabled}
        >
            {leadingElement}
            {labels}
        </button>
    ),
}));

describe('RecapMenu', () => {
    const mockOnClick1 = jest.fn();
    const mockOnClick2 = jest.fn();

    const mockActions: RecapMenuAction[] = [
        {
            id: 'action1',
            icon: <CheckAllIcon size={18}/>,
            label: 'Mark as read',
            onClick: mockOnClick1,
        },
        {
            id: 'action2',
            icon: <RefreshIcon size={18}/>,
            label: 'Regenerate',
            onClick: mockOnClick2,
        },
    ];

    test('should render menu button', () => {
        renderWithContext(<RecapMenu actions={mockActions}/>);

        expect(screen.getByTestId('menu-container')).toBeInTheDocument();
    });

    test('should render all menu items', () => {
        renderWithContext(<RecapMenu actions={mockActions}/>);

        const menuItems = screen.getAllByTestId('menu-item');
        expect(menuItems).toHaveLength(2);
    });

    test('should render menu item labels', () => {
        renderWithContext(<RecapMenu actions={mockActions}/>);

        expect(screen.getByText('Mark as read')).toBeInTheDocument();
        expect(screen.getByText('Regenerate')).toBeInTheDocument();
    });

    test('should call onClick when menu item is clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(<RecapMenu actions={mockActions}/>);

        const menuItems = screen.getAllByTestId('menu-item');
        await user.click(menuItems[0]);

        expect(mockOnClick1).toHaveBeenCalledTimes(1);
        expect(mockOnClick2).not.toHaveBeenCalled();
    });

    test('should handle disabled menu items', () => {
        const disabledActions: RecapMenuAction[] = [
            {
                id: 'action1',
                icon: <CheckAllIcon size={18}/>,
                label: 'Disabled action',
                onClick: mockOnClick1,
                disabled: true,
            },
        ];

        renderWithContext(<RecapMenu actions={disabledActions}/>);

        const menuItem = screen.getByTestId('menu-item');
        expect(menuItem).toBeDisabled();
    });

    test('should render with custom button className', () => {
        const customClassName = 'custom-menu-button';
        renderWithContext(
            <RecapMenu
                actions={mockActions}
                buttonClassName={customClassName}
            />,
        );

        const button = screen.getByTestId('menu-button');
        expect(button).toHaveClass(customClassName);
    });

    test('should use custom aria label when provided', () => {
        const customAriaLabel = 'Custom options menu';
        renderWithContext(
            <RecapMenu
                actions={mockActions}
                ariaLabel={customAriaLabel}
            />,
        );

        const button = screen.getByTestId('menu-button');
        expect(button).toHaveAttribute('aria-label', customAriaLabel);
    });

    test('should use default aria label when not provided', () => {
        renderWithContext(<RecapMenu actions={mockActions}/>);

        const button = screen.getByTestId('menu-button');
        expect(button).toHaveAttribute('aria-label', 'Recap options');
    });

    test('should handle empty actions array', () => {
        renderWithContext(<RecapMenu actions={[]}/>);

        const menuItems = screen.queryAllByTestId('menu-item');
        expect(menuItems).toHaveLength(0);
    });

    test('should handle destructive menu items', () => {
        const destructiveAction: RecapMenuAction[] = [
            {
                id: 'delete',
                icon: <RefreshIcon size={18}/>,
                label: 'Delete',
                onClick: mockOnClick1,
                isDestructive: true,
            },
        ];

        renderWithContext(<RecapMenu actions={destructiveAction}/>);

        expect(screen.getByText('Delete')).toBeInTheDocument();
    });
});

