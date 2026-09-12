// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PolicyHierarchicalValues, {
    emitPolicyIdsToNames,
    hydratePolicyNamesToIds,
} from './policy_adapter';
import type {PolicyHierarchicalValuesProps} from './policy_adapter';

import {joinGraphOptions} from '../graph';
import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from '../graph/page_all_access_control_field_options';

jest.mock('../graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('../graph/page_all_access_control_field_options'),

    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

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

const duplicateNames = () => [
    opt('a', 'Same'),
    opt('b', 'Same'),
];

const deferred = <T, >() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

const chrome = {
    menuId: 'value-selector-menu-0',
    buttonId: 'value-selector-button-0',
    buttonDataTestId: 'valueSelectorMenuButton',
};

const trigger = () => screen.getByTestId('valueSelectorMenuButton');
const openMenu = async () => {
    await userEvent.click(trigger());
};
const row = (name: string) => screen.getByRole('menuitemcheckbox', {name});
const everyRow = () => screen.queryAllByRole('menuitemcheckbox');
const checkboxOf = (name: string) => row(name).querySelector('.hierarchical-value-menu__checkbox') as HTMLElement;
const chevronOf = (name: string) => row(name).querySelector('.hierarchical-value-menu__chevron') as HTMLElement;

const lastSignal = () => {
    const call = mockPageAll.mock.calls[mockPageAll.mock.calls.length - 1];
    return call[1]!.signal!;
};

const settle = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};

const renderPolicy = (overrides: Partial<PolicyHierarchicalValuesProps> = {}) => {
    const props: PolicyHierarchicalValuesProps = {
        field: {id: 'field-1', object_type: 'user', attrs: {}},
        names: [],
        onNamesChange: jest.fn(),
        ...chrome,
        ...overrides,
    };
    const rendered = renderWithContext(<PolicyHierarchicalValues {...props}/>);
    return {
        ...rendered,
        props,
        rerenderSame: () => rendered.rerender(<PolicyHierarchicalValues {...props}/>),
    };
};

describe('hierarchical value menu adapters', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        mockPageAll.mockResolvedValue([]);
    });

    describe('hydratePolicyNamesToIds', () => {
        const join = () => joinGraphOptions(hierarchy());

        test('resolves a name to its option id', () => {
            expect(hydratePolicyNamesToIds(['F-18 Program'], join().byExactName)).toEqual({
                ids: ['opt-f18'],
                fallbackLabels: {'opt-f18': 'F-18 Program'},
            });
        });

        test('resolves several names in order', () => {
            expect(hydratePolicyNamesToIds(['Air Program', 'Rotary'], join().byExactName).ids).toEqual([
                'opt-air',
                'opt-rotary',
            ]);
        });

        test('is case-sensitive', () => {
            expect(hydratePolicyNamesToIds(['f-18 program'], join().byExactName).ids).toEqual(['f-18 program']);
        });

        test('keeps an unresolved name as its own id', () => {
            expect(hydratePolicyNamesToIds(['Retired'], join().byExactName)).toEqual({
                ids: ['Retired'],
                fallbackLabels: {Retired: 'Retired'},
            });
        });

        test('mixes resolved and unresolved names', () => {
            expect(hydratePolicyNamesToIds(['Air Program', 'Retired'], join().byExactName).ids).toEqual([
                'opt-air',
                'Retired',
            ]);
        });

        test('records the last known name for every id', () => {
            expect(hydratePolicyNamesToIds(['Air Program', 'Retired'], join().byExactName).fallbackLabels).toEqual({
                'opt-air': 'Air Program',
                Retired: 'Retired',
            });
        });

        test('dedupes two names that resolve to the same id', () => {
            const byExactName = joinGraphOptions(duplicateNames()).byExactName;

            expect(hydratePolicyNamesToIds(['Same', 'Same'], byExactName).ids).toHaveLength(1);
        });

        test('returns empty for no names', () => {
            expect(hydratePolicyNamesToIds([], join().byExactName)).toEqual({ids: [], fallbackLabels: {}});
        });

        test('hydrates against an empty join without throwing', () => {
            expect(hydratePolicyNamesToIds(['Air Program'], joinGraphOptions([]).byExactName).ids).toEqual([
                'Air Program',
            ]);
        });
    });

    describe('emitPolicyIdsToNames', () => {
        const byId = () => joinGraphOptions(hierarchy()).byId;

        test('emits the option name for a known id', () => {
            expect(emitPolicyIdsToNames(['opt-f18'], byId(), {})).toEqual(['F-18 Program']);
        });

        test('preserves id order', () => {
            expect(emitPolicyIdsToNames(['opt-rotary', 'opt-air'], byId(), {})).toEqual(['Rotary', 'Air Program']);
        });

        test('falls back to the last known name for an unknown id', () => {
            expect(emitPolicyIdsToNames(['ghost'], byId(), {ghost: 'Retired Program'})).toEqual(['Retired Program']);
        });

        test('falls back to the id itself with no label', () => {
            expect(emitPolicyIdsToNames(['ghost'], byId(), {})).toEqual(['ghost']);
        });

        test('prefers the fetched name over the fallback', () => {
            expect(emitPolicyIdsToNames(['opt-f18'], byId(), {'opt-f18': 'Old Name'})).toEqual(['F-18 Program']);
        });

        test('still emits a stale selection', () => {
            expect(emitPolicyIdsToNames(['opt-air', 'Retired'], byId(), {Retired: 'Retired'})).toEqual([
                'Air Program',
                'Retired',
            ]);
        });

        test('dedupes two ids that emit the same name', () => {
            expect(emitPolicyIdsToNames(['a', 'b'], joinGraphOptions(duplicateNames()).byId, {})).toEqual(['Same']);
        });

        test('emits an empty array for no ids', () => {
            expect(emitPolicyIdsToNames([], byId(), {})).toEqual([]);
        });
    });

    describe('PolicyHierarchicalValues', () => {
        test('does not fetch by itself', async () => {
            renderPolicy();

            await settle();

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('never passes prefetchOnMount', async () => {
            renderPolicy({
                field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true}},
                names: ['Anything'],
            });

            await settle();

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('hydrates row names to checked rows from the field payload', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderPolicy({
                field: {id: 'field-1', object_type: 'user', attrs: {options: [opt('opt-f18', 'F-18 Program')]}},
                names: ['F-18 Program'],
            });

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).toHaveAttribute('aria-checked', 'true');
        });

        test('hydrates from the fetched options when the payload omitted them', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderPolicy({
                field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true, options: []}},
                names: ['F-18 Program'],
            });

            await openMenu();

            expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).toHaveAttribute('aria-checked', 'true');
        });

        // The real user-visible consequence of hydrating in the same commit as the
        // status flip, and the thing `hydrates from the fetched options...` above
        // does not assert: the row opens *expanded* to its selected value. Seeding
        // expand-to-selected happens once per open, off the first 'loaded' render,
        // so if the join were announced a commit later this would seed from the
        // pre-hydration selection and the tree would open collapsed.
        test('opens expanded to a hydrated selection', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderPolicy({
                field: {id: 'field-1', object_type: 'user', attrs: {options_omitted: true, options: []}},
                names: ['F-18 Program'],
            });

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'});

            expect(everyRow().map((element) => element.getAttribute('aria-label'))).toEqual([
                'Air Program',
                'Fighter Jet',
                'F-18 Program',
                'Rotary',
            ]);
        });

        test('emits names when a row is selected', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onNamesChange = jest.fn();
            renderPolicy({onNamesChange});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(onNamesChange).toHaveBeenCalledWith(['Air Program']);
        });

        test('emits names in id order after a second selection', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onNamesChange = jest.fn();
            renderPolicy({onNamesChange, names: ['Air Program']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            // A selected branch is not opened for its own sake, so Rotary has to
            // be revealed before it can be checked.
            await userEvent.click(chevronOf('Air Program'));
            await userEvent.click(checkboxOf('Rotary'));

            expect(onNamesChange).toHaveBeenCalledWith(['Air Program', 'Rotary']);
        });

        test('emits an empty array on the last uncheck', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onNamesChange = jest.fn();
            renderPolicy({onNamesChange, names: ['Air Program']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(checkboxOf('Air Program'));

            expect(onNamesChange).toHaveBeenCalledWith([]);
        });

        test('unmounting after the last uncheck aborts the walk', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const {unmount} = renderPolicy({names: ['Air Program']});

            await openMenu();
            const signal = lastSignal();
            unmount();

            expect(signal.aborted).toBe(true);
        });

        test('keeps and re-emits a stale name', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onNamesChange = jest.fn();
            renderPolicy({onNamesChange, names: ['Air Program', 'Retired']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            await userEvent.click(chevronOf('Air Program'));
            await userEvent.click(checkboxOf('Rotary'));

            expect(onNamesChange).toHaveBeenCalledWith(['Air Program', 'Retired', 'Rotary']);
        });

        test('shows a stale name as a chip', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderPolicy({names: ['Air Program', 'Retired']});

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});

            expect(trigger()).toHaveTextContent('Retired');
        });

        test('unchecking a stale name drops only it', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const onNamesChange = jest.fn();
            renderPolicy({onNamesChange, names: ['Air Program', 'Retired']});

            await settle();

            // A stale name has no row in the tree, so its chip is the only way to
            // drop it.
            await userEvent.click(screen.getByRole('button', {name: 'Remove Retired'}));

            expect(onNamesChange).toHaveBeenCalledWith(['Air Program']);
        });

        test('forwards the host chrome props', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderPolicy();

            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
            await openMenu();

            expect(screen.getByRole('menu')).toHaveAttribute('id', 'value-selector-menu-0');
        });

        test('does not refetch on every render', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const {rerenderSame} = renderPolicy();

            await openMenu();
            await screen.findByRole('menuitemcheckbox', {name: 'Air Program'});
            rerenderSame();
            rerenderSame();
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });
    });
});
