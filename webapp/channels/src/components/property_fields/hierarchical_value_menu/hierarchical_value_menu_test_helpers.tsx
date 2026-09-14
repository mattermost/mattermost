// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuProps} from './hierarchical_value_menu';

export const COPY = {
    placeholder: 'Select values...',
    searchLabel: 'Search values',
    empty: 'This attribute has no values yet.',
    withheld: 'The values for this attribute are not available to you here.',
    error: 'These values could not be loaded.',
    noResults: 'No values match.',
};

export const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id, name, parents, create_at: 1,
});

// Air Program ─ Fighter Jet ─ F-18 Program
//             └ Rotary
export const hierarchy = () => [
    opt('opt-air', 'Air Program'),
    opt('opt-jet', 'Fighter Jet', ['Air Program']),
    opt('opt-f18', 'F-18 Program', ['Fighter Jet']),
    opt('opt-rotary', 'Rotary', ['Air Program']),
];

// Dragon ─┐
//         ├─ Crew Capsule
// Falcon ─┘
export const diamond = () => [
    opt('opt-dragon', 'Dragon'),
    opt('opt-falcon', 'Falcon'),
    opt('opt-capsule', 'Crew Capsule', ['Dragon', 'Falcon']),
];

// Two roots, so MUI's own row typeahead has somewhere to move focus to.
export const twoRoots = () => [
    opt('opt-air', 'Air Program'),
    opt('opt-rotary', 'Rotary'),
];

export const baseProps = (): HierarchicalValueMenuProps => ({
    field: {id: 'field-1', object_type: 'user', type: 'graph', attrs: {}},
    selectedIds: [],
    onSelectedIdsChange: jest.fn(),
    menuId: 'value-selector-menu-0',
    buttonId: 'value-selector-button-0',
    buttonDataTestId: 'valueSelectorMenuButton',
});

export const deferred = <T, >() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

export const abortErrorOf = () => new DOMException('aborted', 'AbortError');

export const httpErrorOf = (status: number) => Object.assign(new Error(`request failed with ${status}`), {status_code: status});

export const renderMenu = (overrides: Partial<HierarchicalValueMenuProps> = {}) => {
    const props = {...baseProps(), ...overrides};
    const rendered = renderWithContext(<HierarchicalValueMenu {...props}/>);
    return {
        ...rendered,
        props,
        rerenderWith: (next: Partial<HierarchicalValueMenuProps>) =>
            rendered.rerender(<HierarchicalValueMenu {...{...props, ...next}}/>),
    };
};

export const trigger = () => screen.getByTestId('valueSelectorMenuButton');
export const openMenu = async () => {
    await userEvent.click(trigger());
};
export const closeMenu = async () => {
    await userEvent.keyboard('{Escape}');
};

export const row = (name: string) => screen.getByRole('menuitemcheckbox', {name});
export const allRows = (name: string) => screen.getAllByRole('menuitemcheckbox', {name});
export const maybeRow = (name: string) => screen.queryByRole('menuitemcheckbox', {name});
export const everyRow = () => screen.queryAllByRole('menuitemcheckbox');
export const searchBox = () => screen.getByRole('textbox', {name: COPY.searchLabel});
export const statusRow = () => screen.getByRole('menuitem');

export const partOf = (element: HTMLElement, className: string) =>
    element.querySelector(`.hierarchical-value-menu__${className}`) as HTMLElement;

export const checkboxOf = (name: string) => partOf(row(name), 'checkbox');
export const labelOf = (name: string) => partOf(row(name), 'label');
export const chevronOf = (name: string) => partOf(row(name), 'chevron');
export const hintOf = (name: string) => partOf(row(name), 'hint');

export const focusRow = async (name: string) => {
    const element = row(name);
    await act(async () => {
        element.focus();
    });
};

export const settle = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};
