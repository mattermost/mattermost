// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuField, HierarchicalValueMenuProps} from './hierarchical_value_menu';

import {clearPropertyFieldOptionWalks, pageAllPropertyFieldOptions} from '../page_all_property_field_options';
import type * as PageAllModule from '../page_all_property_field_options';

jest.mock('../page_all_property_field_options', () => ({
    ...jest.requireActual('../page_all_property_field_options'),
    pageAllPropertyFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllPropertyFieldOptions);

const COPY = {
    placeholder: 'Select values...',
    searchLabel: 'Search values',
    empty: 'This attribute has no values yet.',
    withheld: 'The values for this attribute are not available to you here.',
    error: 'These values could not be loaded.',
    missingIdentity: 'This attribute is missing the information needed to load its values.',
    noResults: 'No values match.',
};

const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id, name, parents, create_at: 1,
});

// Air Program ─ Fighter Jet ─ F-18 Program
//             └ Rotary
const hierarchy = () => [
    opt('opt-air', 'Air Program'),
    opt('opt-jet', 'Fighter Jet', ['Air Program']),
    opt('opt-f18', 'F-18 Program', ['Fighter Jet']),
    opt('opt-rotary', 'Rotary', ['Air Program']),
];

// Dragon ─┐
//         ├─ Crew Capsule
// Falcon ─┘
const diamond = () => [
    opt('opt-dragon', 'Dragon'),
    opt('opt-falcon', 'Falcon'),
    opt('opt-capsule', 'Crew Capsule', ['Dragon', 'Falcon']),
];

// Two roots, so MUI's own row typeahead has somewhere to move focus to.
const twoRoots = () => [
    opt('opt-air', 'Air Program'),
    opt('opt-rotary', 'Rotary'),
];

const baseProps = (): HierarchicalValueMenuProps => ({
    field: {id: 'field-1', object_type: 'user', type: 'graph', attrs: {}},
    selectedIds: [],
    onSelectedIdsChange: jest.fn(),
    menuId: 'value-selector-menu-0',
    buttonId: 'value-selector-button-0',
    buttonDataTestId: 'valueSelectorMenuButton',
});

const deferred = <T, >() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

const abortErrorOf = () => new DOMException('aborted', 'AbortError');

const httpErrorOf = (status: number) => Object.assign(new Error(`request failed with ${status}`), {status_code: status});

const renderMenu = (overrides: Partial<HierarchicalValueMenuProps> = {}) => {
    const props = {...baseProps(), ...overrides};
    const rendered = renderWithContext(<HierarchicalValueMenu {...props}/>);
    return {
        ...rendered,
        props,
        rerenderWith: (next: Partial<HierarchicalValueMenuProps>) =>
            rendered.rerender(<HierarchicalValueMenu {...{...props, ...next}}/>),
    };
};

const trigger = () => screen.getByTestId('valueSelectorMenuButton');
const openMenu = async () => {
    await userEvent.click(trigger());
};
const closeMenu = async () => {
    await userEvent.keyboard('{Escape}');
};

const row = (name: string) => screen.getByRole('menuitemcheckbox', {name});
const allRows = (name: string) => screen.getAllByRole('menuitemcheckbox', {name});
const maybeRow = (name: string) => screen.queryByRole('menuitemcheckbox', {name});
const everyRow = () => screen.queryAllByRole('menuitemcheckbox');
const searchBox = () => screen.getByRole('textbox', {name: COPY.searchLabel});

const partOf = (element: HTMLElement, className: string) =>
    element.querySelector(`.hierarchical-value-menu__${className}`) as HTMLElement;

const checkboxOf = (name: string) => partOf(row(name), 'checkbox');
const labelOf = (name: string) => partOf(row(name), 'label');
const chevronOf = (name: string) => partOf(row(name), 'chevron');
const hintOf = (name: string) => partOf(row(name), 'hint');

const lastSignal = () => {
    const call = mockPageAll.mock.calls[mockPageAll.mock.calls.length - 1];
    return call[1]!.signal!;
};
const signalOfCall = (index: number) => mockPageAll.mock.calls[index][1]!.signal!;

const focusRow = async (name: string) => {
    const element = row(name);
    await act(async () => {
        element.focus();
    });
};

const settle = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};

describe('HierarchicalValueMenu', () => {
    beforeEach(() => {
        // The pager's in-flight map is module state, so it is per test file rather
        // than per test.
        clearPropertyFieldOptionWalks();
        mockPageAll.mockResolvedValue([]);
    });

    describe('fetch lifecycle', () => {
        test('fetches on menu open', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
            expect(mockPageAll).toHaveBeenCalledWith(
                {id: 'field-1', object_type: 'user'},
                {signal: expect.any(AbortSignal)},
            );
        });

        test('never sends linked_field_id or a group id', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = {
                id: 'field-1',
                object_type: 'user',
                linked_field_id: 'template-1',
                attrs: {},
            } as HierarchicalValueMenuField;
            renderMenu({field});

            await openMenu();

            expect(mockPageAll.mock.calls[0][0]).toEqual({id: 'field-1', object_type: 'user'});
            expect(Object.keys(mockPageAll.mock.calls[0][0])).toEqual(['id', 'object_type']);
        });

        test('does not fetch before the menu is opened', () => {
            renderMenu();

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('refetches on every reopen', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await closeMenu();
            await openMenu();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('refetches on reopen even when options_omitted', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true, options: []}}});

            await openMenu();
            await closeMenu();
            await openMenu();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('refetches on reopen even when the field payload inlined its options', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options: hierarchy()}}});

            await openMenu();
            await closeMenu();
            await openMenu();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('fetches on mount when prefetchOnMount is true', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({prefetchOnMount: true});

            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });

        test('does not fetch on mount when prefetchOnMount is false', async () => {
            renderMenu({prefetchOnMount: false});

            await settle();

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('prefetches only once per mount', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const {rerenderWith} = renderMenu({prefetchOnMount: true});
            await settle();

            rerenderWith({prefetchOnMount: true, selectedIds: ['opt-air']});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });

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

        test('aborts the in-flight walk when the menu closes', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu();

            await openMenu();
            const signal = lastSignal();
            await closeMenu();

            await waitFor(() => expect(signal.aborted).toBe(true));
        });

        test('aborts the in-flight walk on unmount', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const {unmount} = renderMenu();

            await openMenu();
            const signal = lastSignal();
            unmount();

            expect(signal.aborted).toBe(true);
        });

        test('aborts a prefetch that is still running when the component unmounts', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const {unmount} = renderMenu({prefetchOnMount: true});
            await settle();

            const signal = lastSignal();
            unmount();

            expect(signal.aborted).toBe(true);
        });

        test('aborts the previous walk when the menu is reopened while one is in flight', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu({prefetchOnMount: true});
            await settle();

            await openMenu();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
            expect(signalOfCall(0).aborted).toBe(true);
            expect(signalOfCall(1).aborted).toBe(false);
        });

        test('does not abort on the mount-time onToggle(false)', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu({prefetchOnMount: true});

            await settle();

            expect(lastSignal().aborted).toBe(false);
        });

        test('an AbortError rejection is not rendered as an error', async () => {
            mockPageAll.mockRejectedValue(abortErrorOf());
            renderMenu();

            await openMenu();
            await settle();

            expect(screen.queryByText(COPY.error)).toBeNull();
            expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();
        });

        test('an AbortError rejection leaves previously loaded options intact', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu({selectedIds: ['opt-air']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await closeMenu();

            mockPageAll.mockRejectedValue(abortErrorOf());
            await openMenu();
            await settle();

            expect(trigger()).toHaveTextContent('Air Program');
            expect(screen.queryByText(COPY.error)).toBeNull();
        });
    });

    describe('loading, error, and retry', () => {
        test('shows a spinner in the open menu while the walk runs', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            renderMenu();

            await openMenu();

            expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
            expect(everyRow()).toHaveLength(0);
        });

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

        test('shows error copy and Retry on a 403', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu();

            await openMenu();

            expect(await screen.findByText(COPY.error)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
        });

        test('shows error copy and Retry on a 404', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(404));
            renderMenu();

            await openMenu();

            expect(await screen.findByText(COPY.error)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
            expect(screen.queryByText(COPY.empty)).toBeNull();
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

        test('Retry re-runs the walk and renders the tree on the second attempt', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await userEvent.click(await screen.findByRole('button', {name: 'Retry'}));

            expect(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'})).toBeInTheDocument();
            expect(mockPageAll).toHaveBeenCalledTimes(2);
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

        test('keeps the chips through an error', async () => {
            mockPageAll.mockRejectedValue(httpErrorOf(403));
            renderMenu({selectedIds: ['opt-f18'], fallbackLabels: {'opt-f18': 'F-18 Program'}});

            await openMenu();
            await screen.findByText(COPY.error);

            expect(trigger()).toHaveTextContent('F-18 Program');
        });

        test('reopening after an error refetches instead of showing stale error copy', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            renderMenu();

            await openMenu();
            await screen.findByText(COPY.error);
            await closeMenu();
            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'})).toBeInTheDocument();
            expect(screen.queryByText(COPY.error)).toBeNull();
        });

        test('shows error chrome and no Retry when field.id is missing', async () => {
            renderMenu({field: {object_type: 'user', attrs: {}}});

            await openMenu();

            expect(await screen.findByText(COPY.missingIdentity)).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('shows error chrome and no Retry when field.object_type is missing', async () => {
            renderMenu({field: {id: 'field-1', attrs: {}}});

            await openMenu();

            expect(await screen.findByText(COPY.missingIdentity)).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();
        });

        test('does not call the pager at all for a field with no identity', async () => {
            renderMenu({field: {attrs: {}}});

            await openMenu();
            await settle();

            expect(mockPageAll).not.toHaveBeenCalled();
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

        test('200 [] with options_count uses withheld copy', async () => {
            mockPageAll.mockResolvedValue([]);
            renderMenu({field: {id: 'field-1', object_type: 'user', attrs: {options_count: 1200}}});

            await openMenu();

            expect(await screen.findByText(COPY.withheld)).toBeInTheDocument();
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

    describe('tree rendering and hit split', () => {
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

        test('a shared_only flat list renders every option as a root', async () => {
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

        test('a row is named by its label alone', async () => {
            mockPageAll.mockResolvedValue(diamond());
            renderMenu({selectedIds: ['opt-capsule']});

            await openMenu();

            expect(await screen.findAllByRole('menuitemcheckbox', {name: 'Crew Capsule'})).toHaveLength(2);
            expect(hintOf('Dragon')).toBeNull();
            expect(allRows('Crew Capsule')[0]).toHaveTextContent('Also under Falcon');
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

        test('Also under Oxford-joins three or more other parents', async () => {
            mockPageAll.mockResolvedValue([
                opt('p1', 'P1'),
                opt('p2', 'P2'),
                opt('p3', 'P3'),
                opt('v', 'V', ['P1', 'P2', 'P3']),
            ]);
            const {unmount} = renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'P1'});
            await userEvent.click(labelOf('P1'));

            expect(hintOf('V')).toHaveTextContent('Also under P2 and P3');
            unmount();

            mockPageAll.mockResolvedValue([
                opt('p1', 'P1'),
                opt('p2', 'P2'),
                opt('p3', 'P3'),
                opt('p4', 'P4'),
                opt('v', 'V', ['P1', 'P2', 'P3', 'P4']),
            ]);
            renderMenu();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'P1'});
            await userEvent.click(labelOf('P1'));

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
            await userEvent.click(labelOf('Air Program'));
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

        test('Space toggles the focused row', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(twoRoots(), {onSelectedIdsChange});

            await focusRow('Rotary');
            await userEvent.keyboard(' ');

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
        });

        test('Enter toggles the focused row', async () => {
            const onSelectedIdsChange = jest.fn();
            await openTree(twoRoots(), {onSelectedIdsChange});

            await focusRow('Rotary');
            await userEvent.keyboard('{Enter}');

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
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

    describe('closed control chips', () => {
        test('shows the placeholder when nothing is selected', () => {
            renderMenu();

            expect(trigger()).toHaveTextContent(COPY.placeholder);
        });

        test('shows one chip per selected value id', () => {
            renderMenu({
                selectedIds: ['opt-air', 'opt-rotary'],
                fallbackLabels: {'opt-air': 'Air Program', 'opt-rotary': 'Rotary'},
            });

            expect(trigger().querySelectorAll('.hierarchical-value-menu__chip')).toHaveLength(2);
        });

        test('renders every chip with no overflow indicator', () => {
            const ids = Array.from({length: 12}, (unused, index) => `opt-${index}`);
            const fallbackLabels = Object.fromEntries(ids.map((id, index) => [id, `Option ${index}`]));
            renderMenu({selectedIds: ids, fallbackLabels});

            expect(trigger().querySelectorAll('.hierarchical-value-menu__chip')).toHaveLength(12);
            expect(trigger().textContent).not.toMatch(/\+\d/);
        });

        test('chips wrap rather than truncate', () => {
            const ids = Array.from({length: 12}, (unused, index) => `opt-${index}`);
            const fallbackLabels = Object.fromEntries(ids.map((id, index) => [id, `Option ${index}`]));
            renderMenu({selectedIds: ids, fallbackLabels});

            expect(trigger().querySelector('.hierarchical-value-menu__chips')).not.toBeNull();
        });

        test('the chip X removes the value', async () => {
            const onSelectedIdsChange = jest.fn();
            renderMenu({
                onSelectedIdsChange,
                selectedIds: ['opt-air', 'opt-rotary'],
                fallbackLabels: {'opt-air': 'Air Program', 'opt-rotary': 'Rotary'},
            });

            await userEvent.click(screen.getByRole('button', {name: 'Remove Air Program'}));

            expect(onSelectedIdsChange).toHaveBeenCalledWith(['opt-rotary']);
        });

        test('the chip X does not open the menu', async () => {
            renderMenu({selectedIds: ['opt-air'], fallbackLabels: {'opt-air': 'Air Program'}});

            await userEvent.click(screen.getByRole('button', {name: 'Remove Air Program'}));

            expect(screen.queryByRole('menu')).toBeNull();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('Enter on the chip X removes the value and does not open the menu', async () => {
            const onSelectedIdsChange = jest.fn();
            renderMenu({
                onSelectedIdsChange,
                selectedIds: ['opt-air'],
                fallbackLabels: {'opt-air': 'Air Program'},
            });

            const remove = screen.getByRole('button', {name: 'Remove Air Program'});
            await act(async () => {
                remove.focus();
            });
            await userEvent.keyboard('{Enter}');

            expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
            expect(screen.queryByRole('menu')).toBeNull();
        });

        test('the chip X is not rendered when disabled', () => {
            renderMenu({
                disabled: true,
                selectedIds: ['opt-air'],
                fallbackLabels: {'opt-air': 'Air Program'},
            });

            expect(screen.queryByRole('button', {name: 'Remove Air Program'})).toBeNull();
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

        test('trailingChips are rendered after the chips', () => {
            renderMenu({
                selectedIds: ['opt-air'],
                fallbackLabels: {'opt-air': 'Air Program'},
                trailingChips: <span data-testid='masked-chip'/>,
            });

            expect(screen.getByTestId('masked-chip')).toBeInTheDocument();
            const chips = trigger().querySelector('.hierarchical-value-menu__chips') as HTMLElement;
            expect(chips.lastElementChild).toBe(screen.getByTestId('masked-chip'));
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

    describe('integration with the real pager', () => {
        const actual = jest.requireActual<typeof PageAllModule>('../page_all_property_field_options');

        beforeEach(() => {
            actual.clearPropertyFieldOptionWalks();
            mockPageAll.mockImplementation(actual.pageAllPropertyFieldOptions);
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
