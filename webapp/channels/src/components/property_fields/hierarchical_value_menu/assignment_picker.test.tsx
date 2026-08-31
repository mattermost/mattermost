// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AssignmentGraphPicker from './assignment_picker';
import type {AssignmentGraphPickerProps} from './assignment_picker';
import type {HierarchicalValueMenuField} from './hierarchical_value_menu';

import {clearPropertyFieldOptionWalks, pageAllPropertyFieldOptions} from '../page_all_property_field_options';

jest.mock('../page_all_property_field_options', () => ({
    ...jest.requireActual('../page_all_property_field_options'),
    pageAllPropertyFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllPropertyFieldOptions);

const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id, name, parents, create_at: 1,
});

// Regime 1: a small field that inlines every option.
const REGIME_1: PropertyFieldOption[] = [
    opt('opt1', 'Option 1'),
    opt('opt2', 'Option 2', ['Option 1']),
    opt('opt3', 'Option 3'),
    opt('opt4', 'Option 4'),
    opt('opt5', 'Option 5'),
];

// Regime 2: 201-1000 options, still inlined in full, and carrying neither
// options_omitted nor options_count.
const REGIME_2: PropertyFieldOption[] = Array.from(
    {length: 300},
    (_, index) => opt(`big-${index}`, `Big ${index}`),
);

const fieldOf = (overrides: HierarchicalValueMenuField['attrs'] = {}): HierarchicalValueMenuField => ({
    id: 'field1',
    object_type: 'user',
    type: 'graph',
    attrs: overrides,
});

const renderPicker = (overrides: Partial<AssignmentGraphPickerProps> = {}, flagOn = true) => {
    const props: AssignmentGraphPickerProps = {
        field: fieldOf({options: REGIME_1}),
        ids: [],
        onIdsChange: jest.fn(),
        fallback: () => <div data-testid='legacy-control'/>,
        menuId: 'assignment-menu',
        buttonId: 'assignment-button',
        buttonDataTestId: 'assignment-trigger',
        ariaLabel: 'Programs',
        ...overrides,
    };

    const view = renderWithContext(<AssignmentGraphPicker {...props}/>, {
        entities: {general: {config: {FeatureFlagPropertyFieldGraph: flagOn ? 'true' : 'false'}}},
    });

    return {
        props,
        rerenderWith: (next: Partial<AssignmentGraphPickerProps>) => view.rerender(
            <AssignmentGraphPicker
                {...props}
                {...next}
            />,
        ),
    };
};

const trigger = () => screen.getByTestId('assignment-trigger');

const openMenu = async () => {
    await userEvent.click(trigger());
    await screen.findByRole('menu');
};

// Nothing here should reach the network. A test that forgets to stub the walk
// must fail loudly rather than fall through to the real Client4, and an
// open-ended stub must not be able to feed an accumulating keyset walk.
const throwingDefault = () => {
    mockPageAll.mockImplementation(() => {
        throw new Error('pageAllPropertyFieldOptions called without an explicit mock for this test');
    });
};

describe('AssignmentGraphPicker', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        throwingDefault();
    });

    test('P1: renders the fallback and never calls it twice when the flag is off', () => {
        const fallback = jest.fn(() => <div data-testid='legacy-control'/>);
        renderPicker({fallback}, false);

        expect(screen.getByTestId('legacy-control')).toBeInTheDocument();
        expect(screen.queryByTestId('assignment-trigger')).not.toBeInTheDocument();
        expect(fallback).toHaveBeenCalledTimes(1);
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('P2: does not invoke the fallback when the flag is on', () => {
        const fallback = jest.fn(() => <div data-testid='legacy-control'/>);
        renderPicker({fallback});

        expect(trigger()).toBeInTheDocument();
        expect(screen.queryByTestId('legacy-control')).not.toBeInTheDocument();
        expect(fallback).not.toHaveBeenCalled();
    });

    test('P3: prefetches for an omitted field', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        renderPicker({field: fieldOf({options_omitted: true, options_count: 1010}), ids: []});

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
        expect(mockPageAll).toHaveBeenCalledWith(
            {id: 'field1', object_type: 'user'},
            expect.anything(),
        );
    });

    test('P4: prefetches for a field holding an unnamed id', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        renderPicker({field: fieldOf({options: [opt('a', 'Alpha')]}), ids: ['a', 'ghost']});

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
    });

    test('P5: does not prefetch when every held id is named inline', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        const {rerenderWith} = renderPicker({field: fieldOf({options: REGIME_1}), ids: ['opt1', 'opt3']});

        await screen.findByText('Option 1');
        expect(mockPageAll).not.toHaveBeenCalled();

        // Regime 2 is the one the parent plan's ">200 means omitted" phrasing
        // would have made prefetch: 300 inline options, no markers.
        rerenderWith({field: fieldOf({options: REGIME_2}), ids: ['big-7']});

        await screen.findByText('Big 7');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('P6: reports names for held ids only', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        const onNamesResolved = jest.fn();
        renderPicker({
            field: fieldOf({options_omitted: true}),
            ids: ['opt1'],
            onNamesResolved,
        });

        await waitFor(() => expect(onNamesResolved).toHaveBeenCalledTimes(1));
        expect(onNamesResolved).toHaveBeenCalledWith({opt1: 'Option 1'});
    });

    test('P7: omits an unresolved id from the reported names', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        const onNamesResolved = jest.fn();
        renderPicker({
            field: fieldOf({options_omitted: true}),
            ids: ['opt1', 'ghost'],
            onNamesResolved,
        });

        await waitFor(() => expect(onNamesResolved).toHaveBeenCalledTimes(1));
        expect(onNamesResolved).toHaveBeenCalledWith({opt1: 'Option 1'});
        expect(onNamesResolved.mock.calls[0][0]).not.toHaveProperty('ghost');
    });

    test('P7b: reports the name of a value selected after the fetch landed', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        const onNamesResolved = jest.fn();
        renderPicker({
            field: fieldOf({options_omitted: true}),
            ids: [],
            onNamesResolved,
        });

        await openMenu();
        await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Option 3'}));

        // Nothing was held when the walk landed, so this name can only come
        // from the selection itself.
        expect(onNamesResolved).toHaveBeenCalledWith({opt3: 'Option 3'});
    });

    test('P8: does not refetch when the selection changes while the menu is open', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);

        // A controlled host, so a toggle really does change the `ids` prop and
        // therefore the identity of every inline callback the picker receives.
        const Host = () => {
            const [ids, setIds] = React.useState<string[]>([]);
            return (
                <AssignmentGraphPicker
                    field={fieldOf({options: REGIME_1})}
                    ids={ids}
                    onIdsChange={setIds}
                    onNamesResolved={() => {}}
                    fallback={() => <div/>}
                    menuId='assignment-menu'
                    buttonId='assignment-button'
                    buttonDataTestId='assignment-trigger'
                    ariaLabel='Programs'
                />
            );
        };

        renderWithContext(<Host/>, {
            entities: {general: {config: {FeatureFlagPropertyFieldGraph: 'true'}}},
        });

        await openMenu();
        await screen.findByRole('menuitemcheckbox', {name: 'Option 1'});
        expect(mockPageAll).toHaveBeenCalledTimes(1);

        for (const name of ['Option 3', 'Option 4', 'Option 5']) {
            // eslint-disable-next-line no-await-in-loop
            await userEvent.click(screen.getByRole('menuitemcheckbox', {name}));
        }

        expect(screen.getByRole('menuitemcheckbox', {name: 'Option 3'})).toHaveAttribute('aria-checked', 'true');
        expect(mockPageAll).toHaveBeenCalledTimes(1);
    });

    test('P9: keeps reporting names across a rerender with a new onNamesResolved identity', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        const first = jest.fn();
        const second = jest.fn();

        const {rerenderWith} = renderPicker({
            field: fieldOf({options_omitted: true}),
            ids: ['opt1'],
            onNamesResolved: first,
        });

        await waitFor(() => expect(first).toHaveBeenCalledTimes(1));

        rerenderWith({
            field: fieldOf({options_omitted: true}),
            ids: ['opt1'],
            onNamesResolved: second,
        });

        // The mount prefetch is latched, so a rerender must not walk again.
        expect(mockPageAll).toHaveBeenCalledTimes(1);

        await openMenu();
        await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
        expect(second).toHaveBeenCalledWith({opt1: 'Option 1'});
        expect(first).toHaveBeenCalledTimes(1);
    });

    test('P10: forwards disabled to the trigger', () => {
        renderPicker({disabled: true});

        expect(trigger()).toBeDisabled();
    });

    test('P11: does not report at all when the walk names none of the held ids', async () => {
        // The empty-report skip. Without it, a field whose held ids resolve to
        // nothing pushes an empty map -- and so a setState and a re-render --
        // on mount and again on every menu open. It cannot cause a refetch,
        // since handleOptionsLoaded's identity is stable, so the cost is a
        // wasted render rather than a walk.
        mockPageAll.mockResolvedValue(REGIME_1);
        const onNamesResolved = jest.fn();
        renderPicker({
            field: fieldOf({options_omitted: true}),
            ids: ['ghost-1', 'ghost-2'],
            onNamesResolved,
        });

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
        await openMenu();
        await screen.findByRole('menuitemcheckbox', {name: 'Option 1'});

        expect(onNamesResolved).not.toHaveBeenCalled();
    });
});
