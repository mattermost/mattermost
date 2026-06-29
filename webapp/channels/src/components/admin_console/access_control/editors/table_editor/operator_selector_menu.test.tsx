// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import OperatorSelectorMenu from './operator_selector_menu';

describe('OperatorSelectorMenu', () => {
    const defaultProps = {
        currentOperator: 'is',
        disabled: false,
        onChange: jest.fn(),
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders with current operator label', () => {
        renderWithContext(<OperatorSelectorMenu {...defaultProps}/>);
        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('is');
    });

    test('shows all 6 operators when attributeType is text', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                attributeType='text'
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        expect(menuItems).toHaveLength(6);
    });

    test('shows all 6 operators when attributeType is select', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                attributeType='select'
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        expect(menuItems).toHaveLength(6);
    });

    test('shows all 6 operators when attributeType is not provided', () => {
        renderWithContext(<OperatorSelectorMenu {...defaultProps}/>);

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        expect(menuItems).toHaveLength(6);
    });

    test('shows only "has any of" and "has all of" operators when attributeType is multiselect', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='has any of'
                attributeType='multiselect'
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        expect(menuItems).toHaveLength(2);
        const menuTexts = menuItems.map((item) => item.textContent);
        expect(menuTexts).toEqual(['has any of', 'has all of']);
    });

    test('hides multiselect operators for non-multiselect attribute types', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='is'
                attributeType='text'
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        const menuTexts = menuItems.map((item) => item.textContent);
        expect(menuTexts).not.toContain('has any of');
        expect(menuTexts).not.toContain('has all of');
    });
});
