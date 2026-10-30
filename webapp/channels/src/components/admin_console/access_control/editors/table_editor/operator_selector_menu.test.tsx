// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import OperatorSelectorMenu from './operator_selector_menu';

const openMenu = () => {
    const menu = document.getElementById('operator-selector-menu');
    if (!menu) {
        throw new Error('the operator menu is not open');
    }
    return menu;
};

// The open menu read top to bottom. Group titles and operators are reported
// together so a title's position relative to the operators it titles is part of
// the assertion, and an operator's label is kept apart from its description so
// a collapsed label column cannot pass as a described one.
type OutlineEntry = {group: string} | {label: string; description?: string};

const menuOutline = (): OutlineEntry[] => Array.from(openMenu().children).
    flatMap((child): OutlineEntry[] => {
        if (child.tagName === 'H4' && child.getAttribute('role') === 'presentation') {
            return [{group: child.textContent ?? ''}];
        }
        if (child.getAttribute('role') !== 'menuitemradio') {
            return [];
        }

        const labelColumn = child.querySelector('.label-elements')!;
        if (labelColumn.children.length < 2) {
            return [{label: labelColumn.textContent ?? ''}];
        }
        return [{
            label: labelColumn.children[0].textContent ?? '',
            description: labelColumn.children[1].textContent ?? '',
        }];
    });

const menuLabels = () => menuOutline().map((entry) => ('group' in entry ? `group: ${entry.group}` : entry.label));

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

        // These two operators are also in the graph menu, under the same string
        // ids, where they carry help text. Only the graph menu describes them.
        expect(menuOutline()).toEqual([
            {label: 'has any of'},
            {label: 'has all of'},
        ]);
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

    describe('graph attributes', () => {
        const renderGraphMenu = (currentOperator = 'coversAll') => renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator={currentOperator}
                attributeType='graph'
            />,
        );

        test('groups the operators under three titles, each carrying its help text', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            // The wording is the point of the menu: "all" means every selected
            // value for the covers operators but every value the user holds for
            // the within ones, which is what the help text spells out.
            expect(menuOutline()).toEqual([
                {group: 'Parents (any level)'},
                {
                    label: 'has each of or a parent of',
                    description: 'The user has each selected value, or a parent of it. (Covers All)',
                },
                {
                    label: 'has any of or a parent of',
                    description: 'The user has at least one selected value, or a parent of it. (Covers Any)',
                },
                {group: 'Children (any level)'},
                {
                    label: 'is entirely within',
                    description: 'The user has at least one value, and each is a selected value or a child of one. (Within All)',
                },
                {
                    label: 'has any of or a child of',
                    description: 'At least one value the user has is a selected value, or a child of one. (Within Any)',
                },
                {group: 'Exact match'},
                {
                    label: 'has any of',
                    description: 'The user has at least one selected value. A parent or a child is not enough. (Has Any Of)',
                },
                {
                    label: 'has all of',
                    description: 'The user has every selected value. A parent or a child is not enough. (Has All Of)',
                },
            ]);
        });

        test('sets the function name apart from the rest of the description', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            // It names a function rather than explaining the operator, so it is
            // de-emphasised — which needs it in an element of its own. The menu
            // also opts into the wider, wrapping layout the descriptions need.
            expect(openMenu()).toHaveClass('select-operator-mui-menu--described');
            const functionNames = Array.from(openMenu().querySelectorAll('.operator-selector-menu__function-name')).
                map((element) => element.textContent);
            expect(functionNames).toEqual([
                '(Covers All)',
                '(Covers Any)',
                '(Within All)',
                '(Within Any)',
                '(Has Any Of)',
                '(Has All Of)',
            ]);
        });

        test('names an operator by its label and its help text together', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            // The description is part of the item, so it is read out with the
            // label rather than left to sighted users — which is also why a
            // caller cannot find an operator by its label alone.
            expect(screen.getByRole('menuitemradio', {
                name: 'has all of The user has every selected value. A parent or a child is not enough. (Has All Of)',
            })).toHaveAttribute('id', 'has all of');
            expect(screen.queryByRole('menuitemradio', {name: 'has all of'})).not.toBeInTheDocument();
        });

        test('shows only the label on the closed dropdown, without the help text', () => {
            renderGraphMenu();

            // Anchored: toHaveTextContent is a substring match, so the help text
            // leaking onto the trigger would otherwise still pass.
            expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent(/^has each of or a parent of$/);
        });

        test('renders a stored operator identifier under the label it maps to', () => {
            // The stored identifiers are not the labels, so a row the server
            // reports as withinAll has to land on the label that identifier
            // maps to.
            renderGraphMenu('withinAll');

            expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('is entirely within');

            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            const checked = screen.getAllByRole('menuitemradio').filter((item) => item.getAttribute('aria-checked') === 'true');
            expect(checked).toHaveLength(1);
            expect(checked[0]).toHaveAttribute('id', 'withinAll');
        });

        test('emits the stored operator identifier, not the label, when one is picked', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            fireEvent.click(screen.getByText('is entirely within'));

            expect(defaultProps.onChange).toHaveBeenCalledWith('withinAll');
        });

        const filterBy = (text: string) => fireEvent.change(
            screen.getByRole('textbox', {name: 'Search operators...'}),
            {target: {value: text}},
        );

        test('drops a group title when the filter leaves it with no operators', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            filterBy('parent');

            // Filtered on the labels, so the two parent operators survive and the
            // other groups go with their titles. The exact-match operators stay
            // out even though their descriptions mention a parent.
            expect(menuLabels()).toEqual([
                'group: Parents (any level)',
                'has each of or a parent of',
                'has any of or a parent of',
            ]);

            // Matching across groups keeps each title with its own survivors
            // rather than collapsing them into one run.
            filterBy('any of');
            expect(menuLabels()).toEqual([
                'group: Parents (any level)',
                'has any of or a parent of',
                'group: Children (any level)',
                'has any of or a child of',
                'group: Exact match',
                'has any of',
            ]);

            // Nothing matches: no titles are left standing over nothing.
            filterBy('ZZZ');
            expect(menuLabels()).toEqual([]);
        });

        test('restores the whole grouped menu after an operator is picked', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
            const unfiltered = menuLabels();

            filterBy('child');
            fireEvent.click(screen.getByText('has any of or a child of'));

            // Reopening on the narrowed list would hide most of the menu, so
            // picking an operator clears the filter.
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
            expect(menuLabels()).toEqual(unfiltered);
        });

        test('steps over a group title when the operators are walked by keyboard', () => {
            renderGraphMenu();
            fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

            // The titles are interleaved with the operators, so a title sits
            // between the last operator of one group and the first of the next.
            // Arrowing across that boundary has to land on the operator.
            const operators = screen.getAllByRole('menuitemradio');
            operators[1].focus();
            fireEvent.keyDown(openMenu(), {key: 'ArrowDown', code: 'ArrowDown'});

            expect(document.activeElement).toBe(operators[2]);
            expect(operators[2]).toHaveAttribute('id', 'withinAll');
        });
    });

    test.each(['text', 'select', 'multiselect', 'rank'])('hides the hierarchy predicates for a %s attribute', (attributeType) => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='is'
                attributeType={attributeType}
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuTexts = screen.getAllByRole('menuitemradio').map((item) => item.textContent);
        expect(menuTexts).not.toContain('has each of or a parent of');
        expect(menuTexts).not.toContain('has any of or a parent of');
        expect(menuTexts).not.toContain('is entirely within');
        expect(menuTexts).not.toContain('has any of or a child of');

        expect(openMenu()).not.toHaveClass('select-operator-mui-menu--described');
        expect(openMenu().querySelectorAll('.operator-selector-menu__function-name')).toHaveLength(0);
        expect(menuOutline().filter((entry) => !('label' in entry) || entry.description !== undefined)).toEqual([]);
    });

    test('lists the ordinal operators, undescribed, for a ranked attribute', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='is exactly'
                attributeType='rank'
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        expect(menuOutline()).toEqual([
            {label: 'is exactly'},
            {label: 'is not'},
            {label: 'is at least'},
            {label: 'is greater than'},
            {label: 'is at most'},
            {label: 'is less than'},
        ]);
    });

    test('falls back to the flat list for a graph attribute that advertises its own operators', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='coversAll'
                attributeType='graph'
                allowedOperators={['coversAll', 'has any of']}
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        // An explicit operator set is the whole menu, so there is no group to
        // put an operator under and the help text goes with the groups.
        expect(menuOutline()).toEqual([
            {label: 'has each of or a parent of'},
            {label: 'has any of'},
        ]);
    });

    test('restricts the menu to allowedOperators when provided (native attribute)', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='is'
                attributeType='text'
                allowedOperators={['is', 'is not']}
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        const menuTexts = menuItems.map((item) => item.textContent);
        expect(menuTexts).toEqual(['is', 'is not']);
    });

    test('shows only the younger than operator for native createat', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='younger than'
                attributeType='text'
                allowedOperators={['younger than']}
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        const menuTexts = menuItems.map((item) => item.textContent);
        expect(menuTexts).toEqual(['younger than (days)']);
    });

    test('shows advertised inCIDR operator for IP session attributes', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='in IP range'
                attributeType='text'
                allowedOperators={['is', 'in IP range']}
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        const menuTexts = menuItems.map((item) => item.textContent);
        expect(menuTexts).toEqual(['is', 'in IP range']);
    });

    test('shows advertised version operators for version session attributes', () => {
        renderWithContext(
            <OperatorSelectorMenu
                {...defaultProps}
                currentOperator='version is at least'
                attributeType='text'
                allowedOperators={['version is at least', 'version is greater than']}
            />,
        );

        fireEvent.click(screen.getByTestId('operatorSelectorMenuButton'));

        const menuItems = screen.getAllByRole('menuitemradio');
        const menuTexts = menuItems.map((item) => item.textContent);
        expect(menuTexts).toHaveLength(2);
        expect(menuTexts[0]).toContain('version is at least');
        expect(menuTexts[1]).toContain('version is greater than');
    });
});
