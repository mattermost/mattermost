// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {act, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {HierarchicalValueMenuProps} from './hierarchical_value_menu';
import {
    COPY,
    allRows,
    checkboxOf,
    chevronOf,
    closeMenu,
    deferred,
    diamond,
    everyRow,
    focusRow,
    hierarchy,
    hintOf,
    httpErrorOf,
    labelOf,
    maybeRow,
    openMenu,
    opt,
    partOf,
    renderMenu,
    row,
    searchBox,
    settle,
    trigger,
    twoRoots,
} from './hierarchical_value_menu_test_helpers';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from '../page_all_property_field_options';
import type * as PageAllModule from '../page_all_property_field_options';

jest.mock('../page_all_property_field_options', () => ({
    ...jest.requireActual('../page_all_property_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

describe('HierarchicalValueMenu', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        mockPageAll.mockResolvedValue([]);
    });

    describe('tree rendering and hit split', () => {
        test('does not render a partial page as a tree', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu();

            await openMenu();
            expect(everyRow()).toHaveLength(0);

            await act(async () => {
                walk.resolve(hierarchy());
            });

            expect(maybeRow('Air Program')).not.toBeNull();
        });

        test('renders only the roots when nothing is selected', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(everyRow()).toHaveLength(1);
            expect(everyRow()[0]).toHaveAccessibleName('Air Program');
        });

        test('renders roots in the order the pager returned them', async () => {
            mockPageAll.mockResolvedValue([opt('opt-z', 'Zulu'), opt('opt-a', 'Alpha')]);
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Zulu'});

            expect(everyRow().map((element) => element.getAttribute('aria-label'))).toEqual(['Zulu', 'Alpha']);
        });

        // Nothing access-mode-specific here despite where this arrived from: the
        // assertion is that options with no `parents` key all render as roots.
        test('options with no parents key render as roots', async () => {
            mockPageAll.mockResolvedValue([
                {id: 'a', name: 'Alpha', create_at: 1},
                {id: 'b', name: 'Bravo', create_at: 2},
            ]);
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Alpha'});

            expect(everyRow()).toHaveLength(2);
            everyRow().forEach((element) => {
                expect(element).not.toHaveAttribute('aria-expanded');
            });
        });

        test('a branch row exposes aria-expanded false when collapsed', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'})).toHaveAttribute('aria-expanded', 'false');
        });

        test('a leaf row has no aria-expanded', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).not.toHaveAttribute('aria-expanded');
        });

        test('clicking the checkbox toggles selection without expanding', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-air']);
            expect(row('Air Program')).toHaveAttribute('aria-expanded', 'false');
            expect(maybeRow('Fighter Jet')).toBeNull();
        });

        test('clicking the label expands a branch without selecting', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(labelOf('Air Program'));

            expect(onSelectedIdsChange).not.toHaveBeenCalled();
            expect(maybeRow('Fighter Jet')).not.toBeNull();
        });

        test('clicking the chevron expands a branch without selecting', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(chevronOf('Air Program'));

            expect(onSelectedIdsChange).not.toHaveBeenCalled();
            expect(maybeRow('Fighter Jet')).not.toBeNull();
        });

        test('clicking the label again collapses the branch', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(labelOf('Air Program'));
            await userEvent.click(labelOf('Air Program'));

            expect(maybeRow('Fighter Jet')).toBeNull();
        });

        test('clicking a leaf row anywhere selects it', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange, selectedIds: ['opt-f18']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});
            await userEvent.click(labelOf('F-18 Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
        });

        test('clicking a leaf row element itself selects it', async () => {
            mockPageAll.mockResolvedValue(twoRoots());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Rotary'}));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
        });

        test('clicking a branch row element itself expands rather than selects', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'}));

            expect(onSelectedIdsChange).not.toHaveBeenCalled();
            expect(maybeRow('Fighter Jet')).not.toBeNull();
        });

        test('unchecking a selected value removes only that id', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange, selectedIds: ['opt-air', 'opt-rotary']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
        });

        test('unchecking the last selected value emits an empty array', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange, selectedIds: ['opt-air']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
        });

        // Both occurrences are findable by the label alone even though each one's
        // hint text differs, which is what pins the accessible name to the label.
        // The hint and "Also under" assertions this used to also carry live in
        // `a root occurrence has no Also under line` and `each occurrence names
        // its other parents in Also under`.
        test('a row is named by its label alone', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();

            expect(await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'})).toHaveLength(2);
        });

        test('aria-checked reflects the selection', async () => {
            mockPageAll.mockResolvedValue(twoRoots());
            renderMenu({selectedIds: ['opt-air']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(row('Air Program')).toHaveAttribute('aria-checked', 'true');
            expect(row('Rotary')).toHaveAttribute('aria-checked', 'false');
        });

        test('the menu stays open after a selection', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(maybeRow('Air Program')).not.toBeNull();
        });

        test('the menu stays open after two consecutive selections', async () => {
            mockPageAll.mockResolvedValue(twoRoots());
            const onSelectedIdsChange = jest.fn();
            const {rerenderWith} = renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            rerenderWith({onSelectedIdsChange, selectedIds: ['opt-air']});
            await userEvent.click(checkboxOf('Rotary'));

            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(onSelectedIdsChange).toHaveBeenNthCalledWith(1, ['opt-air']);
            expect(onSelectedIdsChange).toHaveBeenNthCalledWith(2, ['opt-air', 'opt-rotary']);
        });

        test('read_only options are selectable', async () => {
            mockPageAll.mockResolvedValue([{...opt('opt-air', 'Air Program'), read_only: true}]);
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(row('Air Program')).not.toHaveAttribute('aria-disabled');
            await userEvent.click(checkboxOf('Air Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-air']);
        });

        test('read_only options are not visually or semantically disabled', async () => {
            mockPageAll.mockResolvedValue([{...opt('opt-air', 'Air Program'), read_only: true}]);
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(row('Air Program').className).not.toContain('Mui-disabled');
        });
    });

    describe('{n} inside and expand-to-selected', () => {
        test('a collapsed ancestor shows {n} inside for its selected descendants', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});
            await userEvent.click(labelOf('Air Program'));

            expect(row('Air Program')).toHaveTextContent('1 inside');
        });

        test('{n} inside counts by value id, not by occurrence', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();
            await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'});
            await userEvent.click(labelOf('Dragon'));

            expect(row('Dragon')).toHaveTextContent('1 inside');
            expect(row('Dragon')).not.toHaveTextContent('2 inside');
        });

        test('{n} inside counts descendants across depth', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18', 'opt-rotary']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});
            await userEvent.click(labelOf('Air Program'));

            expect(row('Air Program')).toHaveTextContent('2 inside');
        });

        test('{n} inside is not shown on an expanded branch', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});

            expect(row('Air Program')).not.toHaveTextContent('inside');
        });

        test('{n} inside is not shown when no descendant is selected', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(row('Air Program')).not.toHaveTextContent('inside');
        });

        test('{n} inside is not shown on a leaf', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).not.toHaveTextContent('inside');
        });

        test('{n} inside is exposed to AT via aria-describedby', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});
            await userEvent.click(labelOf('Air Program'));

            const describedBy = row('Air Program').getAttribute('aria-describedby');
            expect(describedBy).not.toBeNull();
            expect(document.getElementById(describedBy!)).toHaveTextContent('1 inside');
        });

        test('defaults to expanding the ancestors of a selected value', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).toBeInTheDocument();
            expect(maybeRow('Rotary')).not.toBeNull();
        });

        test('does not expand a selected leaf for its own sake', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-rotary']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Rotary'});

            expect(maybeRow('Fighter Jet')).not.toBeNull();
            expect(maybeRow('F-18 Program')).toBeNull();
        });

        test('leaves unrelated branches collapsed', async () => {
            mockPageAll.mockResolvedValue([
                ...hierarchy(),
                opt('opt-sea', 'Sea Program'),
                opt('opt-sub', 'Submarine', ['Sea Program']),
            ]);
            renderMenu({selectedIds: ['opt-f18']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});

            expect(maybeRow('Sea Program')).not.toBeNull();
            expect(maybeRow('Submarine')).toBeNull();
        });

        test('opens every occurrence path to a multi-parent selection', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();
            await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'});

            expect(row('Dragon')).toHaveAttribute('aria-expanded', 'true');
            expect(row('Falcon')).toHaveAttribute('aria-expanded', 'true');
            expect(allRows('Crew Capsule')).toHaveLength(2);
        });

        test('everything is collapsed when nothing is selected', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(everyRow()).toHaveLength(1);
        });

        test('a selection made while the menu is open does not re-expand the tree', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            const {rerenderWith} = renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));
            rerenderWith({onSelectedIdsChange, selectedIds: ['opt-air']});

            expect(maybeRow('Fighter Jet')).toBeNull();
        });

        test('re-seeds expand-to-selected on the next open', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const {rerenderWith} = renderMenu({selectedIds: ['opt-f18']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});
            await userEvent.click(labelOf('Air Program'));
            expect(maybeRow('F-18 Program')).toBeNull();

            await closeMenu();
            rerenderWith({selectedIds: ['opt-f18']});
            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).toBeInTheDocument();
        });

        test('a stale selected id does not open anything', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['ghost']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(everyRow()).toHaveLength(1);
        });
    });


    describe('multi-parent occurrences', () => {
        const expandBothRoots = async () => {
            await userEvent.click(labelOf('Dragon'));
            await userEvent.click(labelOf('Falcon'));
        };

        test('a multi-parent value renders one row per parent occurrence', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Dragon'});
            await expandBothRoots();

            expect(allRows('Crew Capsule')).toHaveLength(2);
        });

        test('toggling one occurrence toggles the value id for all of them', async () => {
            mockPageAll.mockResolvedValue(diamond());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Dragon'});
            await expandBothRoots();
            await userEvent.click(partOf(allRows('Crew Capsule')[0], 'checkbox'));

            expect(onSelectedIdsChange).toHaveBeenCalledTimes(1);
            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-capsule']);
        });

        test('both occurrences show as checked when the value is selected', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();
            await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'});

            allRows('Crew Capsule').forEach((element) => {
                expect(element).toHaveAttribute('aria-checked', 'true');
            });
        });

        test('unchecking one occurrence removes the single id', async () => {
            mockPageAll.mockResolvedValue(diamond());
            const onSelectedIdsChange = jest.fn();
            renderMenu({onSelectedIdsChange, selectedIds: ['opt-capsule']});

            await openMenu();
            await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'});
            await userEvent.click(partOf(allRows('Crew Capsule')[1], 'checkbox'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
        });

        test('the closed control shows one chip per value id', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();
            await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'});

            expect(trigger().querySelectorAll('.hierarchical-value-menu__chip')).toHaveLength(1);
            expect(trigger()).toHaveTextContent('Crew Capsule');
        });

        test('each occurrence names its other parents in Also under', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();
            await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'});

            expect(allRows('Crew Capsule')[0]).toHaveTextContent('Also under Falcon');
            expect(allRows('Crew Capsule')[1]).toHaveTextContent('Also under Dragon');
        });

        const openParentsOf = async (parents: string[]) => {
            mockPageAll.mockResolvedValue([
                ...parents.map((name) => opt(name.toLowerCase(), name)),
                opt('v', 'V', parents),
            ]);
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: parents[0]});
            await userEvent.click(labelOf(parents[0]));
        };

        test('Also under joins two other parents with and', async () => {
            await openParentsOf(['P1', 'P2', 'P3']);

            expect(hintOf('V')).toHaveTextContent('Also under P2 and P3');
        });

        test('Also under Oxford-joins three or more other parents', async () => {
            await openParentsOf(['P1', 'P2', 'P3', 'P4']);

            expect(hintOf('V')).toHaveTextContent('Also under P2, P3, and P4');
        });

        test('a root occurrence has no Also under line', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Dragon'});

            expect(row('Dragon')).not.toHaveTextContent('Also under');
        });

        test('a single-parent child has no Also under line', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(labelOf('Air Program'));

            expect(row('Fighter Jet')).not.toHaveTextContent('Also under');
        });
    });


    describe('keyboard', () => {
        const openTree = async (options = hierarchy(), overrides: Partial<HierarchicalValueMenuProps> = {}) => {
            mockPageAll.mockResolvedValue(options);
            const rendered = renderMenu(overrides);
            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: options[0].name});
            return rendered;
        };

        test('ArrowDown from the search box focuses the first row', async () => {
            await openTree();

            await userEvent.keyboard('{ArrowDown}');

            expect(row('Air Program')).toHaveFocus();
        });

        test('ArrowDown moves between rows', async () => {
            await openTree(twoRoots());

            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowDown}');

            expect(row('Rotary')).toHaveFocus();
        });

        test('ArrowUp on the first row returns focus to the search box', async () => {
            await openTree(twoRoots());

            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowUp}');

            expect(searchBox()).toHaveFocus();
        });

        // A deliberate divergence from the prototype, which clamps at the ends:
        // `Menu.Container` never sets MUI's `disableListWrap`. Asserted so that
        // adding it later is a visible decision rather than a silent change to
        // this widget's keyboard behaviour.
        test('ArrowDown wraps from the last row back to the first', async () => {
            await openTree(twoRoots());

            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowDown}');

            expect(row('Air Program')).toHaveFocus();
        });

        // The call *count* matters as much as the argument in the three tests
        // below. ButtonBase synthesises a click from an Enter keydown after the
        // row's own onKeyDown has handled it, so without the keydown guard in
        // `activate` the row acts twice per Enter -- and toHaveBeenCalledWith
        // alone cannot see that, because it passes when any call matches and both
        // calls carry the same argument.
        test('Space toggles the focused row', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(twoRoots(), {onSelectedIdsChange});

            await focusRow('Rotary');
            await userEvent.keyboard(' ');

            expect(onSelectedIdsChange).toHaveBeenCalledTimes(1);
            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
        });

        test('Enter toggles the focused row exactly once', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(twoRoots(), {onSelectedIdsChange});

            await focusRow('Rotary');
            await userEvent.keyboard('{Enter}');

            expect(onSelectedIdsChange).toHaveBeenCalledTimes(1);
            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
        });

        test('Enter on a branch row selects without expanding', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(hierarchy(), {onSelectedIdsChange});

            await focusRow('Air Program');
            await userEvent.keyboard('{Enter}');

            expect(onSelectedIdsChange).toHaveBeenCalledTimes(1);
            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-air']);
            expect(maybeRow('Fighter Jet')).toBeNull();
        });

        test('Space on a branch row selects rather than expands', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(hierarchy(), {onSelectedIdsChange});

            await focusRow('Air Program');
            await userEvent.keyboard(' ');

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-air']);
            expect(maybeRow('Fighter Jet')).toBeNull();
        });

        test('Space does not close the menu', async () => {
            await openTree(twoRoots());

            await focusRow('Rotary');
            await userEvent.keyboard(' ');

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        test('Enter does not close the menu', async () => {
            await openTree(twoRoots());

            await focusRow('Rotary');
            await userEvent.keyboard('{Enter}');

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        test('ArrowRight expands a collapsed branch', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(hierarchy(), {onSelectedIdsChange});

            await focusRow('Air Program');
            await userEvent.keyboard('{ArrowRight}');

            expect(maybeRow('Fighter Jet')).not.toBeNull();
            expect(onSelectedIdsChange).not.toHaveBeenCalled();
        });

        test('ArrowLeft collapses an expanded branch', async () => {
            await openTree();

            await focusRow('Air Program');
            await userEvent.keyboard('{ArrowRight}');
            await focusRow('Air Program');
            await userEvent.keyboard('{ArrowLeft}');

            expect(maybeRow('Fighter Jet')).toBeNull();
        });

        test('ArrowRight on a leaf does nothing', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(twoRoots(), {onSelectedIdsChange});

            await focusRow('Rotary');
            await userEvent.keyboard('{ArrowRight}');

            expect(onSelectedIdsChange).not.toHaveBeenCalled();
            expect(everyRow()).toHaveLength(2);
        });

        test('a printable key on a focused row moves focus to the search box', async () => {
            await openTree();

            await focusRow('Air Program');
            await userEvent.keyboard('f');

            expect(searchBox()).toHaveFocus();
        });

        test('a printable key on a focused row seeds the query', async () => {
            await openTree();

            await focusRow('Air Program');
            await userEvent.keyboard('f');

            expect(searchBox()).toHaveValue('f');
            expect(everyRow().map((element) => element.getAttribute('aria-label'))).toEqual([
                'Fighter Jet',
                'F-18 Program',
            ]);
        });

        test("MUI's own row typeahead does not run", async () => {
            await openTree(twoRoots());

            await focusRow('Air Program');
            await userEvent.keyboard('r');

            expect(searchBox()).toHaveFocus();
            expect(row('Rotary')).not.toHaveFocus();
        });

        test('Escape closes the menu', async () => {
            await openTree();

            await closeMenu();

            await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
        });
    });

    describe('closed control and wiring', () => {
        test('shows a compact pending chip rather than a raw id while prefetching', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu({prefetchOnMount: true, selectedIds: ['opt-f18']});

            await settle();

            expect(trigger()).not.toHaveTextContent('opt-f18');
            expect(document.querySelector('.hierarchical-value-menu__chip--pending')).not.toBeNull();
        });

        test('replaces the pending chip with the fetched name', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu({prefetchOnMount: true, selectedIds: ['opt-f18']});
            await settle();

            await act(async () => {
                walk.resolve(hierarchy());
            });

            expect(trigger()).toHaveTextContent('F-18 Program');
            expect(document.querySelector('.hierarchical-value-menu__chip--pending')).toBeNull();
        });
        test('shows the placeholder when nothing is selected', () => {
            renderMenu();

            expect(trigger()).toHaveTextContent(COPY.placeholder);
        });
        test('the chip X does not open the menu', async () => {
            renderMenu({selectedIds: ['opt-air'], fallbackLabels: {'opt-air': 'Air Program'}});

            await userEvent.click(screen.getByRole('button', {name: 'Remove Air Program'}));

            expect(screen.queryByRole('menu')).toBeNull();
            expect(mockPageAll).not.toHaveBeenCalled();
        });
        test('a stale selected id keeps its fallback label', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['ghost'], fallbackLabels: {ghost: 'Retired Program'}});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(trigger()).toHaveTextContent('Retired Program');
        });

        test('a stale selected id with no fallback shows the id after the fetch settles', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['ghost']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(trigger()).toHaveTextContent('ghost');
        });
        test('a failed read shows unavailable copy rather than a raw id', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu({
                field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true}},
                prefetchOnMount: true,
                selectedIds: ['bqx8ftgmbbn9jxxr4pcgz6h9zc'],
            });

            await settle();

            expect(trigger()).not.toHaveTextContent('bqx8ftgmbbn9jxxr4pcgz6h9zc');
            expect(trigger()).toHaveTextContent('Value unavailable');
            expect(document.querySelector('.hierarchical-value-menu__chip--unavailable')).not.toBeNull();
        });

        test('a failed read does not leave the chip in a pending skeleton', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu({prefetchOnMount: true, selectedIds: ['opt-f18']});

            await settle();

            expect(document.querySelector('.hierarchical-value-menu__chip--pending')).toBeNull();
        });

        test('a failed read still keeps a known fallback name', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu({
                prefetchOnMount: true,
                selectedIds: ['opt-f18'],
                fallbackLabels: {'opt-f18': 'F-18 Program'},
            });

            await settle();

            expect(trigger()).toHaveTextContent('F-18 Program');
            expect(trigger()).not.toHaveTextContent('Value unavailable');
        });
        test('a stale selected id stays in selectedIds', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onSelectedIdsChange = jest.fn();
            renderMenu({
                onSelectedIdsChange,
                selectedIds: ['ghost'],
                fallbackLabels: {ghost: 'Retired Program'},
            });

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['ghost', 'opt-air']);
        });
        test('onMenuOpenChange fires once with false on mount', () => {
            const onMenuOpenChange = jest.fn();
            renderMenu({onMenuOpenChange});

            expect(onMenuOpenChange).toHaveBeenCalledTimes(1);
            expect(onMenuOpenChange).toHaveBeenCalledWith(false);
        });

        test('onMenuOpenChange reports the open and the close', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onMenuOpenChange = jest.fn();
            renderMenu({onMenuOpenChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await closeMenu();

            await waitFor(() => expect(onMenuOpenChange).toHaveBeenLastCalledWith(false));
            expect(onMenuOpenChange.mock.calls.map(([open]) => open)).toEqual([false, true, false]);
        });
    });

    describe('integration with the real pager', () => {
        const actual = jest.requireActual<typeof PageAllModule>('../page_all_property_field_options');

        beforeEach(() => {
            actual.clearPropertyFieldOptionWalks();
            mockPageAll.mockImplementation(actual.pageAllAccessControlFieldOptions);

            // The real pager runs in here, so an unmocked Client4 is a live
            // keyset walk against node-fetch. A test added below without its own
            // spy would not fail -- it would accumulate pages until the heap gave
            // out and take this whole file's report down with it. Throwing by
            // default turns that into one loud, local failure.
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockImplementation(() => {
                throw new Error('Client4.getPropertyFieldOptions called without an explicit mock for this test');
            });
        });

        test('wires the real page-all helper to Client4 with the access_control group', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'})).toBeInTheDocument();
            expect(spy).toHaveBeenCalledWith(
                'access_control',
                'user',
                'field-1',
                expect.objectContaining({perPage: 200}),
            );
        });
    });
});
