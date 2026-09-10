// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import {assignmentFallbackLabels, computeAssignmentPrefetch} from '../graph/assignment_prefetch';
import GraphValueSummary from '../graph/graph_value_summary';
import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from '../graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from '../graph/use_graph_option_names';

import AssignmentGraphPicker from './assignment_picker';
import type {AssignmentGraphPickerProps} from './assignment_picker';
import type {GraphFieldRef} from './hierarchical_value_menu';

jest.mock('../graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('../graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

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

const fieldOf = (overrides: GraphFieldRef['attrs'] = {}): GraphFieldRef => ({
    id: 'field1',
    object_type: 'user',
    type: 'graph',
    attrs: overrides,
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

const settle = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};

describe('AssignmentGraphPicker', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockImplementation(() => {
            throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
        });
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

    test('P10: forwards disabled to the trigger', () => {
        renderPicker({disabled: true});

        expect(trigger()).toBeDisabled();
    });

    test('shows payload names as chips without fetching', async () => {
        renderPicker({
            field: fieldOf({options: [opt('opt-f18', 'F-18 Program')]}),
            ids: ['opt-f18'],
        });

        await settle();

        expect(trigger()).toHaveTextContent('F-18 Program');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('shows a pending chip rather than an id while prefetching', async () => {
        const walk = deferred<PropertyFieldOption[]>();
        mockPageAll.mockReturnValue(walk.promise);
        renderPicker({
            field: fieldOf({options_omitted: true}),
            ids: ['opt-f18'],
        });

        await settle();

        expect(trigger()).not.toHaveTextContent('opt-f18');
        expect(document.querySelector('.hierarchical-value-menu__chip--pending')).not.toBeNull();
    });

    test('commits an empty name map on a successful walk that names none of the held ids', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        const field = fieldOf({options_omitted: true});

        renderWithContext(
            <>
                <AssignmentGraphPicker
                    field={field}
                    ids={['ghost-1', 'ghost-2']}
                    onIdsChange={jest.fn()}
                    fallback={() => <div/>}
                    menuId='assignment-menu'
                    buttonId='assignment-button'
                    buttonDataTestId='assignment-trigger'
                    ariaLabel='Programs'
                />
                <div data-testid='confirm-summary'>
                    <GraphValueSummary
                        field={field}
                        ids={['ghost-1']}
                        mode='confirm'
                    />
                </div>
            </>,
            {entities: {general: {config: {FeatureFlagPropertyFieldGraph: 'true'}}}},
        );

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByTestId('confirm-summary')).toHaveTextContent('ghost-1'));
        expect(screen.getByTestId('confirm-summary')).not.toHaveTextContent('Value unavailable');
    });
});

describe('computeAssignmentPrefetch', () => {
    test('is true when options_omitted', () => {
        expect(computeAssignmentPrefetch({attrs: {options_omitted: true}}, [])).toBe(true);
    });

    test('is true when a selected id is not named by the payload', () => {
        expect(computeAssignmentPrefetch({attrs: {options: [opt('a', 'A')]}}, ['b'])).toBe(true);
    });

    test('is false when the payload names every selected id', () => {
        expect(computeAssignmentPrefetch({attrs: {options: [opt('a', 'A')]}}, ['a'])).toBe(false);
    });

    test('is false with no selection and no omission', () => {
        expect(computeAssignmentPrefetch({attrs: {options: []}}, [])).toBe(false);
    });

    test('is true when the payload has no options and something is selected', () => {
        expect(computeAssignmentPrefetch({attrs: {}}, ['a'])).toBe(true);
    });
});

describe('assignmentFallbackLabels', () => {
    test('maps every payload option id to its name', () => {
        expect(assignmentFallbackLabels({attrs: {options: [opt('a', 'A'), opt('b', 'B')]}})).toEqual({
            a: 'A',
            b: 'B',
        });
    });

    test('skips an option with an empty id', () => {
        expect(assignmentFallbackLabels({attrs: {options: [opt('', 'Legacy')]}})).toEqual({});
    });

    test('is empty for a field with no options', () => {
        expect(assignmentFallbackLabels({})).toEqual({});
    });
});
