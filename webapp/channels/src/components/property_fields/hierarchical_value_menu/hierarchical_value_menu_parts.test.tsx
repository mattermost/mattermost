// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import {act, fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {
    hierarchicalMenuStatusKind,
    HierarchicalMenuSearch,
    HierarchicalMenuStatus,
    isGraphFieldWithheld,
    SelectedValueChips,
} from './hierarchical_value_menu_parts';
import type {ChipLabel} from './hierarchical_value_menu_parts';
import {
    COPY,
    allRows,
    deferred,
    diamond,
    everyRow,
    hierarchy,
    hintOf,
    httpErrorOf,
    chevronOf,
    maybeRow,
    openMenu,
    opt,
    partOf,
    renderMenu,
    row,
    searchBox,
    settle,
    statusRow,
    trigger,
} from './hierarchical_value_menu_test_helpers';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from '../graph/page_all_access_control_field_options';

jest.mock('../graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('../graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

const named = (text: string): ChipLabel => ({text, state: 'named'});

describe('isGraphFieldWithheld', () => {
    test('options_omitted', () => {
        expect(isGraphFieldWithheld({options_omitted: true})).toBe(true);
    });

    test('source_only / shared_only', () => {
        expect(isGraphFieldWithheld({access_mode: 'source_only'})).toBe(true);
        expect(isGraphFieldWithheld({access_mode: 'shared_only'})).toBe(true);
    });

    test('options_count alone is false', () => {
        expect(isGraphFieldWithheld({options_count: 1200})).toBe(false);
    });

    test('access_mode empty string is false', () => {
        expect(isGraphFieldWithheld({access_mode: ''})).toBe(false);
    });
});

describe('hierarchicalMenuStatusKind', () => {
    const base = {
        status: 'loaded' as const,
        visibleRowCount: 0,
        isSearching: false,
        isWithheld: false,
        optionCount: 0,
    };

    test('error → error_fetch', () => {
        expect(hierarchicalMenuStatusKind({...base, status: 'error'})).toBe('error_fetch');
    });

    test('idle/loading → loading', () => {
        expect(hierarchicalMenuStatusKind({...base, status: 'idle'})).toBe('loading');
        expect(hierarchicalMenuStatusKind({...base, status: 'loading'})).toBe('loading');
    });

    test('rows present → null', () => {
        expect(hierarchicalMenuStatusKind({...base, visibleRowCount: 2})).toBeNull();
    });

    test('searching + 0 rows → no_results', () => {
        expect(hierarchicalMenuStatusKind({...base, isSearching: true})).toBe('no_results');
    });

    test('withheld + 0 rows → withheld', () => {
        expect(hierarchicalMenuStatusKind({...base, isWithheld: true})).toBe('withheld');
    });

    test('empty list → empty', () => {
        expect(hierarchicalMenuStatusKind(base)).toBe('empty');
    });

    test('optionCount > 0 and 0 rows → null', () => {
        expect(hierarchicalMenuStatusKind({...base, optionCount: 2})).toBeNull();
    });
});

describe('SelectedValueChips', () => {
    const renderChips = (overrides: Partial<React.ComponentProps<typeof SelectedValueChips>> = {}) => {
        const props = {
            selectedIds: ['opt-air', 'opt-rotary'],
            labelForId: (id: string) => named(id === 'opt-air' ? 'Air Program' : 'Rotary'),
            disabled: false,
            onRemove: jest.fn(),
            ...overrides,
        };
        const rendered = renderWithContext(<SelectedValueChips {...props}/>);
        return {...rendered, props};
    };

    test('shows one chip per selected value id', () => {
        renderChips();
        expect(document.querySelectorAll('.hierarchical-value-menu__chip')).toHaveLength(2);
    });

    test('renders every chip with no overflow indicator', () => {
        const ids = Array.from({length: 12}, (unused, index) => `opt-${index}`);
        renderChips({
            selectedIds: ids,
            labelForId: (id) => named(`Option ${id.slice(4)}`),
        });
        expect(document.querySelectorAll('.hierarchical-value-menu__chip')).toHaveLength(12);
        expect(document.body.textContent).not.toMatch(/\+\d/);
    });

    test('the chip X removes the value', async () => {
        const onRemove = jest.fn();
        renderChips({onRemove});
        await userEvent.click(screen.getByRole('button', {name: 'Remove Air Program'}));
        expect(onRemove).toHaveBeenCalledWith('opt-air');
    });

    test('Enter on the chip X removes the value', async () => {
        const onRemove = jest.fn();
        renderChips({selectedIds: ['opt-air'], onRemove});
        const remove = screen.getByRole('button', {name: 'Remove Air Program'});
        await act(async () => {
            remove.focus();
        });
        await userEvent.keyboard('{Enter}');
        expect(onRemove).toHaveBeenCalledWith('opt-air');
    });

    test('the chip X is not rendered when disabled', () => {
        renderChips({disabled: true, selectedIds: ['opt-air']});
        expect(screen.queryByRole('button', {name: 'Remove Air Program'})).toBeNull();
    });

    test('trailingChips are rendered after the chips', () => {
        renderChips({
            selectedIds: ['opt-air'],
            trailingChips: <span data-testid='masked-chip'/>,
        });
        expect(screen.getByTestId('masked-chip')).toBeInTheDocument();
        const chips = document.querySelector('.hierarchical-value-menu__chips') as HTMLElement;
        expect(chips.lastElementChild).toBe(screen.getByTestId('masked-chip'));
    });

    test('the remove control on an unnamed chip is named for what it does', () => {
        renderChips({
            selectedIds: ['opt-f18'],
            labelForId: () => ({text: 'Value unavailable', state: 'unavailable'}),
        });
        expect(screen.getByRole('button', {name: 'Remove value'})).toBeInTheDocument();
    });

    test('pending class when state is pending', () => {
        renderChips({
            selectedIds: ['opt-f18'],
            labelForId: () => ({text: '', state: 'pending'}),
        });
        expect(document.querySelector('.hierarchical-value-menu__chip--pending')).not.toBeNull();
    });

    test('unavailable class + Value unavailable text when state is unavailable', () => {
        renderChips({
            selectedIds: ['opt-f18'],
            labelForId: () => ({text: 'Value unavailable', state: 'unavailable'}),
        });
        expect(document.querySelector('.hierarchical-value-menu__chip--unavailable')).not.toBeNull();
        expect(screen.getByText('Value unavailable')).toBeInTheDocument();
    });
});

describe('HierarchicalMenuStatus', () => {
    test('spinner on loading', () => {
        renderWithContext(<HierarchicalMenuStatus kind='loading'/>);
        expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
        expect(screen.getByText('Loading values…')).toBeInTheDocument();
    });

    test('icon + Retry on error_fetch with onRetry', async () => {
        const onRetry = jest.fn();
        renderWithContext(
            <HierarchicalMenuStatus
                kind='error_fetch'
                onRetry={onRetry}
            />,
        );
        expect(screen.getByText(COPY.error)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test.each(['empty', 'withheld', 'no_results'] as const)('no Retry on %s', (kind) => {
        renderWithContext(<HierarchicalMenuStatus kind={kind}/>);
        expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();
    });

    test('copy strings match COPY', () => {
        const {rerender} = renderWithContext(<HierarchicalMenuStatus kind='empty'/>);
        expect(screen.getByText(COPY.empty)).toBeInTheDocument();
        rerender(<HierarchicalMenuStatus kind='withheld'/>);
        expect(screen.getByText(COPY.withheld)).toBeInTheDocument();
        rerender(<HierarchicalMenuStatus kind='no_results'/>);
        expect(screen.getByText(COPY.noResults)).toBeInTheDocument();
    });
});

describe('HierarchicalMenuSearch', () => {
    const renderSearch = (overrides: Partial<React.ComponentProps<typeof HierarchicalMenuSearch>> = {}) => {
        const props = {
            inputName: 'value-selector-menu-0-search',
            value: '',
            disabled: false,
            onChange: jest.fn(),
            onArrowDown: jest.fn(),
            inputRef: React.createRef<HTMLInputElement>(),
            ...overrides,
        };
        const rendered = renderWithContext(<HierarchicalMenuSearch {...props}/>);
        return {...rendered, props};
    };

    test('onChange', async () => {
        const onChange = jest.fn();
        renderSearch({onChange});
        await userEvent.type(screen.getByRole('textbox', {name: COPY.searchLabel}), 'ab');
        expect(onChange).toHaveBeenCalled();
    });

    test('ArrowDown calls onArrowDown', () => {
        const onArrowDown = jest.fn();
        renderSearch({onArrowDown});
        fireEvent.keyDown(screen.getByRole('textbox', {name: COPY.searchLabel}), {key: 'ArrowDown'});
        expect(onArrowDown).toHaveBeenCalledTimes(1);
    });

    test('Space/Enter do not call onArrowDown', () => {
        const onArrowDown = jest.fn();
        renderSearch({onArrowDown});
        const input = screen.getByRole('textbox', {name: COPY.searchLabel});
        fireEvent.keyDown(input, {key: ' '});
        fireEvent.keyDown(input, {key: 'Enter'});
        expect(onArrowDown).not.toHaveBeenCalled();
    });
});

describe('HierarchicalValueMenu chrome (mounted)', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        mockPageAll.mockResolvedValue([]);
    });

    describe('status chrome in the open menu', () => {
        test('shows a spinner in the open menu while the walk runs', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu();

            await openMenu();

            expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
            expect(everyRow()).toHaveLength(0);
        });
        test('shows error copy and Retry on a 403', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu();

            await openMenu();

            expect(await screen.findByText(COPY.error)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
        });
        test('shows error copy and Retry on a network failure', async () => {
            mockPageAll.mockRejectedValue(new TypeError('Failed to fetch'));
            renderMenu();

            await openMenu();

            expect(await screen.findByText(COPY.error)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
        });

        test('shows no tree rows in the error state', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);

            expect(everyRow()).toHaveLength(0);
        });
        test('Retry does not close the menu', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await userEvent.click(await screen.findByRole('button', {name: 'Retry'}));
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        // Tab closes the menu and the arrows skip anything aria-disabled, so the
        // nested Retry button is pointer-only. The row itself carries the action
        // instead: these four tests are the keyboard and AT route to recovery.
        test('the error row takes focus from the search box', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);
            await userEvent.keyboard('{ArrowDown}');

            expect(statusRow()).toHaveFocus();
        });

        test('Enter on the error row retries exactly once', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);
            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{Enter}');

            expect(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'})).toBeInTheDocument();
            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('Enter on the error row does not close the menu', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);
            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{Enter}');
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        test('ArrowUp on the error row returns focus to the search box', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);
            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowUp}');

            expect(searchBox()).toHaveFocus();
        });

        test('a status row with nothing to do stays unfocusable', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.empty);

            expect(statusRow()).toHaveAttribute('aria-disabled', 'true');
        });
        test('keeps the chips through an error', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu({selectedIds: ['opt-f18'], fallbackLabels: {'opt-f18': 'F-18 Program'}});

            await openMenu();
            await screen.findByText(COPY.error);

            expect(trigger()).toHaveTextContent('F-18 Program');
        });
    });

    describe('empty and withheld copy', () => {
        test('a genuinely empty graph says it has no values', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {}}});

            await openMenu();

            expect(await screen.findByText(COPY.empty)).toBeInTheDocument();
        });

        test('200 [] with options_omitted uses withheld copy, not "no values"', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true}}});

            expect(await screen.findByText(COPY.placeholder)).toBeInTheDocument();
            await openMenu();

            expect(await screen.findByText(COPY.withheld)).toBeInTheDocument();
            expect(screen.queryByText(COPY.empty)).toBeNull();
        });

        test('200 [] with options_count uses empty copy, not withheld', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options_count: 1200}}});

            await openMenu();

            expect(await screen.findByText(COPY.empty)).toBeInTheDocument();
            expect(screen.queryByText(COPY.withheld)).toBeNull();
        });

        test('inlined options plus options_count on a cyclic graph render empty, not withheld', async () => {
            const cyclic = [
                opt('opt-a', 'Alpha', ['Bravo']),
                opt('opt-b', 'Bravo', ['Alpha']),
            ];
            mockPageAll.mockResolvedValue([]);
            renderMenu({
                field: {
                    id: 'field-1',
                    object_type: 'user',
                    attrs: {options: cyclic, options_count: 2},
                },
            });

            await openMenu();

            expect(await screen.findByText(COPY.empty)).toBeInTheDocument();
            expect(screen.queryByText(COPY.withheld)).toBeNull();
        });

        test('200 [] with access_mode source_only uses withheld copy', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {access_mode: 'source_only'}}});

            await openMenu();

            expect(await screen.findByText(COPY.withheld)).toBeInTheDocument();
        });

        test('200 [] with access_mode shared_only uses withheld copy', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {access_mode: 'shared_only'}}});

            await openMenu();

            expect(await screen.findByText(COPY.withheld)).toBeInTheDocument();
        });

        test('200 [] with options_count 0 still says there are no values', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options_count: 0}}});

            await openMenu();

            expect(await screen.findByText(COPY.empty)).toBeInTheDocument();
            expect(screen.queryByText(COPY.withheld)).toBeNull();
        });

        test('200 [] with access_mode empty string still says there are no values', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {access_mode: ''}}});

            await openMenu();

            expect(await screen.findByText(COPY.empty)).toBeInTheDocument();
        });

        // A parent cycle resolves to no roots from a non-empty option list, so the
        // tree has nothing to show while the values themselves are real. The menu
        // must not claim there are none -- Phase 2 guards cycles throughout, so it
        // evidently considers them reachable.
        test('a parent cycle does not claim the attribute has no values', async () => {
            mockPageAll.mockResolvedValue([
                opt('opt-a', 'Alpha', ['Bravo']),
                opt('opt-b', 'Bravo', ['Alpha']),
            ]);
            renderMenu();

            await openMenu();
            await settle();

            expect(screen.queryByText(COPY.empty)).toBeNull();
            expect(screen.queryByText(COPY.withheld)).toBeNull();
        });

        test('a value inside a parent cycle is still reachable by search', async () => {
            mockPageAll.mockResolvedValue([
                opt('opt-a', 'Alpha', ['Bravo']),
                opt('opt-b', 'Bravo', ['Alpha']),
            ]);
            renderMenu();

            await openMenu();
            await userEvent.type(searchBox(), 'alpha');

            expect(await screen.findByRole('menuitemcheckbox', {name: 'Alpha'})).toBeInTheDocument();
        });

        test('no search results shows the no-match copy, not the empty-graph copy', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.type(searchBox(), 'zzz');

            expect(await screen.findByText(COPY.noResults)).toBeInTheDocument();
            expect(screen.queryByText(COPY.empty)).toBeNull();
        });
    });

    describe('search', () => {
        const openTree = async (options = hierarchy()) => {
            mockPageAll.mockResolvedValue(options);
            const rendered = renderMenu();
            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: options[0].name});
            return rendered;
        };

        test('renders a visible search box in the open menu', async () => {
            await openTree();

            expect(searchBox()).toBeInTheDocument();
        });

        test('focuses the search box on open', async () => {
            await openTree();

            expect(searchBox()).toHaveFocus();
        });

        test('a non-empty query swaps the tree for a flat result list', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'program');

            expect(everyRow().map((element) => element.getAttribute('aria-label'))).toEqual([
                'Air Program',
                'F-18 Program',
            ]);
        });

        test('search matches on label, case-insensitively', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'f-18');

            expect(everyRow()).toHaveLength(1);
            expect(everyRow()[0]).toHaveAccessibleName('F-18 Program');
        });

        test('search reaches a value whose ancestors are collapsed', async () => {
            await openTree();
            expect(maybeRow('F-18 Program')).toBeNull();

            await userEvent.type(searchBox(), 'f-18');

            expect(maybeRow('F-18 Program')).not.toBeNull();
        });

        test('a search row has no chevron', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'program');

            everyRow().forEach((element) => {
                expect(partOf(element, 'chevron')).toBeNull();
            });
        });

        test('a search row has no aria-expanded', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'program');

            everyRow().forEach((element) => {
                expect(element).not.toHaveAttribute('aria-expanded');
            });
        });

        test('a search row shows the parent path as its hint', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'f-18');

            expect(hintOf('F-18 Program')).toHaveTextContent('Air Program › Fighter Jet');
        });

        test('a search row for a multi-parent value shows the extra-path count', async () => {
            await openTree(diamond());

            await userEvent.type(searchBox(), 'capsule');

            expect(hintOf('Crew Capsule').textContent).toMatch(/· \+1$/);
        });

        test('a multi-parent value produces one search row, not one per occurrence', async () => {
            await openTree(diamond());

            await userEvent.type(searchBox(), 'capsule');

            expect(allRows('Crew Capsule')).toHaveLength(1);
        });

        test('clicking a search row toggles selection', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});
            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            await userEvent.type(searchBox(), 'f-18');
            await userEvent.click(row('F-18 Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-f18']);
        });

        test('the menu stays open after selecting a search row', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'f-18');
            await userEvent.click(row('F-18 Program'));

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        test('clearing the query restores the tree', async () => {
            await openTree();
            await userEvent.click(chevronOf('Air Program'));
            expect(maybeRow('Fighter Jet')).not.toBeNull();

            await userEvent.type(searchBox(), 'f-18');
            expect(maybeRow('Fighter Jet')).toBeNull();

            await userEvent.clear(searchBox());

            expect(maybeRow('Fighter Jet')).not.toBeNull();
        });

        test('a whitespace-only query is treated as empty', async () => {
            await openTree();

            await userEvent.type(searchBox(), '   ');

            expect(everyRow()).toHaveLength(1);
            expect(everyRow()[0]).toHaveAccessibleName('Air Program');
        });

        test('search rows are named by their label alone', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'f-18');

            expect(row('F-18 Program')).toBeInTheDocument();
            expect(row('F-18 Program')).toHaveTextContent('Air Program › Fighter Jet');
        });

        // Both focus tests above run in tree mode. Search rows are keyed by a
        // `search::` occKey in the same ref map, and the search box is the reason
        // the whole search mode exists, so the pair is worth having in both modes.
        test('ArrowDown from the search box focuses the first search row', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'program');
            await userEvent.keyboard('{ArrowDown}');

            expect(row('Air Program')).toHaveFocus();
        });

        test('ArrowUp on the first search row returns focus to the search box', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'program');
            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowUp}');

            expect(searchBox()).toHaveFocus();
        });
        test('Space in the search box does not close the menu', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'a b');

            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(searchBox()).toHaveValue('a b');
        });

        test('Enter in the search box does not close the menu', async () => {
            await openTree();

            await userEvent.type(searchBox(), '{Enter}');

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        test('typing in the search box does not move row focus', async () => {
            await openTree();

            await userEvent.type(searchBox(), 'pro');

            expect(searchBox()).toHaveFocus();
        });
    });

    describe('status affordances and wiring leftovers', () => {
        test('never renders a create-value affordance on an empty graph', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.empty);

            expect(screen.queryByText(/create/i)).toBeNull();
        });

        test('never renders a create-value affordance on an omitted graph', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true}}});

            await openMenu();
            await screen.findByText(COPY.withheld);

            expect(screen.queryByText(/create/i)).toBeNull();
        });

        test('never renders a create-value affordance in the error state', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(500));
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);

            expect(screen.queryByText(/create/i)).toBeNull();
        });

        test('never renders a create-value affordance while a query has no match', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.type(searchBox(), 'Brand New Value');
            await screen.findByText(COPY.noResults);

            expect(screen.queryByText(/create/i)).toBeNull();
        });

        test('renders no max-items or graph-too-large copy for a large graph', async () => {
            const many = Array.from({length: 600}, (unused, index) => opt(`opt-${index}`, `Option ${index}`));
            mockPageAll.mockResolvedValue(many);
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Option 0'});

            expect(everyRow()).toHaveLength(600);
            expect(screen.queryByText(/too (large|many)/i)).toBeNull();
            expect(screen.queryByText(/showing/i)).toBeNull();
        });
        test('an explicit placeholder replaces the default', () => {
            renderMenu({placeholder: 'Pick a program'});

            expect(trigger()).toHaveTextContent('Pick a program');
            expect(trigger()).not.toHaveTextContent(COPY.placeholder);
        });

        test('ariaLabel names the trigger, defaulting to the placeholder', () => {
            const {rerenderWith} = renderMenu();
            expect(trigger()).toHaveAccessibleName(COPY.placeholder);

            rerenderWith({ariaLabel: 'Programs'});

            expect(trigger()).toHaveAccessibleName('Programs');
        });

        test('buttonClassName lands on the trigger', () => {
            renderMenu({buttonClassName: 'policy-row__value-trigger'});

            expect(trigger()).toHaveClass('policy-row__value-trigger');
        });

        test('the trigger keeps its data-testid and the menu keeps its id', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
            await openMenu();

            expect(screen.getByRole('menu')).toHaveAttribute('id', 'value-selector-menu-0');
        });

        test('extraMenuItems are appended after the rows', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({
                extraMenuItems: [
                    <Menu.Item
                        key='channel-attributes'
                        id='channel-attributes'
                        role='menuitemradio'
                        labels={<span data-testid='channel-attributes-label'/>}
                    />,
                ],
            });

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            const list = screen.getByRole('menu');
            expect(list.lastElementChild).toContainElement(screen.getByTestId('channel-attributes-label'));
        });
    });
});
