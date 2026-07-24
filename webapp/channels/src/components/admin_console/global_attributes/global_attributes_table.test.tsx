// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import GlobalAttributesTable, {getDisplayName, getSourceKind} from './global_attributes_table';

// The server keys every field under a real group UUID that differs from the
// group name ('access_control'); fixtures mirror that so the resolve-by-name
// path is exercised, matching the pattern used by the session_attributes tests.
const ACCESS_CONTROL_GROUP_UUID = 'accesscontrolgroupuuid001';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        name: 'field_name',
        type: 'text',
        group_id: ACCESS_CONTROL_GROUP_UUID,
        object_type: 'template',
        target_id: '',
        target_type: 'system',
        create_at: 1700000000000,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {},
        ...overrides,
    } as PropertyField;
}

function getBaseState(): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {},
            properties: {
                fields: {
                    byId: {},
                    byObjectType: {},
                },
            },
        },
    };
}

describe('GlobalAttributesTable', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
    });

    it('shows the loading state before fields resolve', async () => {
        getPropertyFields.mockResolvedValueOnce([]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        });
    });

    it('fetches access_control/template fields scoped to the system target type', async () => {
        getPropertyFields.mockResolvedValueOnce([]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await waitFor(() => {
            expect(getPropertyFields).toHaveBeenCalled();
        });

        expect(getPropertyFields.mock.calls[0].slice(0, 4)).toEqual([
            'access_control',
            'template',
            'system',
            undefined,
        ]);
    });

    it('renders one row per returned field, including fields under a real group UUID', async () => {
        const fields = [
            makeField({id: 'f1', name: 'first_field', attrs: {display_name: 'First Field'}}),
            makeField({id: 'f2', name: 'second_field'}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('First Field')).toBeInTheDocument();
        expect(screen.getByText('second_field')).toBeInTheDocument();
    });

    it('falls back to the field name when no display_name is set', async () => {
        getPropertyFields.mockResolvedValueOnce([makeField({name: 'no_display_name', attrs: {}})]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('no_display_name')).toBeInTheDocument();
    });

    it('sorts rows by name rather than relying on server return order', async () => {
        const fields = [
            makeField({id: 'f1', name: 'zeta_field'}),
            makeField({id: 'f2', name: 'alpha_field'}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await screen.findByText('zeta_field');
        const names = screen.getAllByTestId('global-attribute-name').map((cell) => cell.textContent);
        expect(names).toEqual(['alpha_field', 'zeta_field']);
    });

    it('sorts by the same displayed value as the Attribute column, not the internal name, when they diverge', async () => {
        // Internal names sort z-then-a, but display_name sorts a-then-z — proves the
        // table orders by what the user reads (the Attribute column value), not the
        // hidden internal name behind it.
        const fields = [
            makeField({id: 'f1', name: 'zzz_internal_id', attrs: {display_name: 'Aardvark Attribute'}}),
            makeField({id: 'f2', name: 'aaa_internal_id', attrs: {display_name: 'Zebra Attribute'}}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await screen.findByText('Aardvark Attribute');
        const names = screen.getAllByTestId('global-attribute-name').map((cell) => cell.textContent);
        expect(names).toEqual(['Aardvark Attribute', 'Zebra Attribute']);
    });

    it('renders the Applies-to column as an explicit placeholder, not a blank cell', async () => {
        getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attribute-applies-to')).toBeInTheDocument();
    });

    it('shows the empty-state message when there are no fields', async () => {
        getPropertyFields.mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
    });

    it('shows an error state (not the empty state) when the fetch fails', async () => {
        // Suppress the expected console.error from the load failure this test triggers.
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        getPropertyFields.mockRejectedValue(new Error('boom'));

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-error')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('shows an error state (not the empty state) on a 404, rather than treating it as an empty result', async () => {
        // Suppress the expected console.error from the load failure this test triggers.
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const notFound = Object.assign(new Error('not found'), {status_code: 404});
        getPropertyFields.mockRejectedValue(notFound);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-error')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    describe('Type column', () => {
        it.each([
            ['text', 'Text'],
            ['select', 'Select'],
            ['multiselect', 'Multiselect'],
            ['rank', 'Ranked'],
        ])('renders the %s type with the %s label', async (type, label) => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: type as PropertyField['type']})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent(label);
        });

        it('renders a defined fallback (not a blank cell) for a FieldType outside text/select/multiselect/rank', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'date'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent('Other');
        });
    });

    describe('Options column', () => {
        it('renders "Free Text" for a text field', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'text'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('Free Text');
        });

        it('renders the option count for a select field', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'A'}, {id: 'o2', name: 'B'}, {id: 'o3', name: 'C'}]},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('3 options');
        });

        it('renders an explicit zero-count rather than a blank cell', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'multiselect', attrs: {options: []}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('0 options');
        });

        it('uses the singular "1 option" at the pluralization boundary, not "1 options"', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'A'}]},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('1 option');
            expect(screen.queryByText('1 options')).not.toBeInTheDocument();
        });
    });

    describe('Source column', () => {
        it('resolves the plugin display name when source_plugin_id + protected are set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]).mockResolvedValue([]);

            const state = getBaseState();
            state.plugins = {
                plugins: {
                    'com.example.plugin': {id: 'com.example.plugin', name: 'Example Plugin', version: '1.0.0', webapp: {bundle_path: ''}},
                },
            } as DeepPartial<GlobalState>['plugins'];

            renderWithContext(<GlobalAttributesTable/>, state);

            expect(await screen.findByTestId('global-attribute-source')).toHaveTextContent('Example Plugin');
        });

        it('shows AD/LDAP when attrs.ldap is set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-source')).toHaveTextContent('AD/LDAP');
        });

        it('shows SAML when attrs.saml is set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {saml: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-source')).toHaveTextContent('SAML');
        });

        it('falls back to "Managed here" when no source signal is present', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-source')).toHaveTextContent('Managed here');
        });
    });

    describe('Actions column', () => {
        it('opens the menu with Edit/Duplicate/Delete rendered visibly disabled, not a silent no-op', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).not.toBeDisabled();

            // * Icon-only trigger has an accessible name for screen readers (WCAG 4.1.2)
            expect(trigger).toHaveAccessibleName('More actions');

            await userEvent.click(trigger);

            const menuitems = screen.getAllByRole('menuitem');
            const edit = menuitems.find((el) => el.textContent?.includes('Edit attribute'));
            const duplicate = menuitems.find((el) => el.textContent?.includes('Duplicate attribute'));
            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));

            expect(edit).toBeDefined();
            expect(duplicate).toBeDefined();
            expect(del).toBeDefined();

            expect(edit!).toHaveAttribute('aria-disabled', 'true');
            expect(duplicate!).toHaveAttribute('aria-disabled', 'true');
            expect(del!).toHaveAttribute('aria-disabled', 'true');

            // * Each disabled item explains why, rather than silently doing nothing
            expect(edit!).toHaveTextContent('Coming soon');
            expect(duplicate!).toHaveTextContent('Coming soon');
            expect(del!).toHaveTextContent('Coming soon');
        });
    });
});

describe('getDisplayName', () => {
    it('prefers attrs.display_name over the internal name', () => {
        expect(getDisplayName(makeField({name: 'internal_name', attrs: {display_name: 'Human Name'}}))).toBe('Human Name');
    });

    it('falls back to the internal name when no display_name is set', () => {
        expect(getDisplayName(makeField({name: 'internal_name', attrs: {}}))).toBe('internal_name');
    });
});

describe('getSourceKind', () => {
    it('returns plugin only when both source_plugin_id and protected are set', () => {
        expect(getSourceKind(makeField({attrs: {source_plugin_id: 'p', protected: true}}))).toBe('plugin');
        expect(getSourceKind(makeField({attrs: {source_plugin_id: 'p', protected: false}}))).not.toBe('plugin');
    });

    it('prefers plugin over ldap/saml when both signals are present on the same field', () => {
        expect(getSourceKind(makeField({attrs: {source_plugin_id: 'p', protected: true, ldap: 'x', saml: 'y'}}))).toBe('plugin');
    });

    it('follows the ticket order: plugin, then ldap, then saml, then managed', () => {
        expect(getSourceKind(makeField({attrs: {ldap: 'x', saml: 'y'}}))).toBe('ldap');
        expect(getSourceKind(makeField({attrs: {saml: 'y'}}))).toBe('saml');
        expect(getSourceKind(makeField({attrs: {}}))).toBe('managed');
    });
});
