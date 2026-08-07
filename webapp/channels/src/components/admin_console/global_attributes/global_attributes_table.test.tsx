// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor, within} from '@testing-library/react';
import React from 'react';

import {ClientError} from '@mattermost/client';
import {ChevronDownCircleOutlineIcon, FormatListBulletedIcon, MenuVariantIcon, PowerPlugOutlineIcon, SortAscendingIcon, SyncIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {
    CLASSIFICATIONS_MARKINGS_ADMIN_URL,
    CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
    CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
} from 'components/admin_console/classification_markings/utils';
import ModalController from 'components/modal_controller';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import GlobalAttributesTable, {getDisplayName, getSourceIcon, getSourceKind, getTypeIcon, isClassificationMarkingsField} from './global_attributes_table';

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

function makeClientError(statusCode: number): ClientError {
    return new ClientError('https://example.com', {
        message: 'error',
        status_code: statusCode,
        url: 'https://example.com/api/v4/properties/groups/access_control/template/fields/field-1',
    });
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

type EntitiesPartial = NonNullable<DeepPartial<GlobalState>['entities']>;

// State where the Classification Markings admin page is actually reachable: Enterprise-tier
// license (matching admin_definition.tsx's minLicenseTier(Enterprise) check) and the
// ClassificationMarkings feature flag on, read from the same entities/admin config tree the
// route rule itself reads. Both conditions default to "reachable" but can be independently
// overridden to exercise the AND logic off the all-true/all-false diagonal (e.g. license ok
// but flag off, or vice versa).
function getReachableState(overrides: {licenseSku?: string; classificationMarkingsFlagOn?: boolean} = {}): DeepPartial<GlobalState> {
    const {licenseSku = 'enterprise', classificationMarkingsFlagOn = true} = overrides;
    const state = getBaseState();
    state.entities!.general = {
        license: {IsLicensed: 'true', SkuShortName: licenseSku},
    } as EntitiesPartial['general'];
    state.entities!.admin = {
        config: {FeatureFlags: {ClassificationMarkings: classificationMarkingsFlagOn}},
    } as EntitiesPartial['admin'];
    return state;
}

function getMobileState(): DeepPartial<GlobalState> {
    const state = getReachableState();
    state.views = {browser: {windowSize: WindowSizes.MOBILE_VIEW}} as DeepPartial<GlobalState>['views'];
    return state;
}

function makeClassificationField(overrides: Partial<PropertyField> = {}): PropertyField {
    return makeField({
        name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
        object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
        type: 'rank',
        attrs: {options: [{id: 'o1', name: 'Low', rank: 1}, {id: 'o2', name: 'High', rank: 2}]},
        ...overrides,
    });
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

    it('wraps an ordinary row\'s name in the shared attribute container without the classification modifier or subtitle', async () => {
        getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        const nameCell = await screen.findByTestId('global-attribute-name');

        // * Every row (not just the classification one) renders through the shared
        // .GlobalAttributesTable__attribute wrapper introduced alongside the classification
        // row, but an ordinary row keeps its plain (non-classification) name styling and
        // never renders a subtitle underneath it.
        expect(nameCell.closest('.GlobalAttributesTable__attribute')).toBeInTheDocument();
        expect(nameCell).not.toHaveClass('GlobalAttributesTable__name--classification');
        expect(screen.queryByTestId(/^global-attribute-classification-subtitle/)).not.toBeInTheDocument();
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
        ])('renders the %s type with the %s label and a leading icon', async (type, label) => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: type as PropertyField['type']})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent(label);
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('renders a defined fallback (not a blank cell) for a FieldType outside text/select/multiselect/rank', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'date'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent('Other');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        // Pins the exact icon set to the one used by the User Attributes page's
        // type selector (user_properties_type_menu.tsx) — verified against the
        // Figma design (node 6207:13241), which confirmed the "Ranked" glyph is
        // literally the sort-ascending icon, not an approximation.
        it.each([
            ['text', MenuVariantIcon],
            ['select', ChevronDownCircleOutlineIcon],
            ['multiselect', FormatListBulletedIcon],
            ['rank', SortAscendingIcon],
            ['date', MenuVariantIcon],
        ])('maps the %s field type to the expected icon component', (type, icon) => {
            expect(getTypeIcon(type as PropertyField['type'])).toBe(icon);
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

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Example Plugin');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('resolves a server-only plugin name from the admin plugin statuses rather than showing the raw plugin ID', async () => {
            const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([{
                plugin_id: 'com.mattermost.gahelper',
                name: 'Global Attributes Helper',
                description: '',
                version: '1.0.0',
                cluster_id: '',
                plugin_path: '',
                state: 1,
            }]);

            // No entry in state.plugins: a server-only plugin ships no webapp bundle,
            // so it never registers a client manifest.
            getPropertyFields.mockResolvedValueOnce([makeField({
                attrs: {source_plugin_id: 'com.mattermost.gahelper', protected: true},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await waitFor(() => {
                expect(getPluginStatuses).toHaveBeenCalled();
            });

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Global Attributes Helper');
            expect(cell).not.toHaveTextContent('com.mattermost.gahelper');

            getPluginStatuses.mockRestore();
        });

        it('does not fetch plugin statuses when no row is plugin-owned', async () => {
            const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([]);

            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await screen.findByTestId('global-attribute-source');

            expect(getPluginStatuses).not.toHaveBeenCalled();

            getPluginStatuses.mockRestore();
        });

        it('shows AD/LDAP when attrs.ldap is set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('AD/LDAP');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows SAML when attrs.saml is set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {saml: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('SAML');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows "AD/LDAP, SAML" when both attrs.ldap and attrs.saml are set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'employeeID', saml: 'position'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('AD/LDAP, SAML');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('falls back to "Managed here" (no icon) when no source signal is present', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Managed here');
            expect(cell.querySelector('svg')).not.toBeInTheDocument();
        });

        it.each([
            ['plugin', PowerPlugOutlineIcon],
            ['ldap_and_saml', SyncIcon],
            ['ldap', SyncIcon],
            ['saml', SyncIcon],
        ])('maps the %s source kind to the expected icon component', (kind, icon) => {
            expect(getSourceIcon(kind as ReturnType<typeof getSourceKind>)).toBe(icon);
        });

        it('maps the managed source kind to no icon', () => {
            expect(getSourceIcon('managed')).toBeUndefined();
        });
    });

    describe('Actions column', () => {
        it('opens the menu with Edit/Duplicate still visibly disabled and Delete enabled', async () => {
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

            // * Each still-stubbed item explains why, rather than silently doing nothing
            expect(edit!).toHaveTextContent('Coming soon');
            expect(duplicate!).toHaveTextContent('Coming soon');

            // * Delete is live now, so it carries neither the disabled state nor the stub label
            expect(del!).not.toHaveAttribute('aria-disabled', 'true');
            expect(del!).not.toHaveTextContent('Coming soon');
        });
    });

    describe('Delete action', () => {
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

        beforeEach(() => {
            deletePropertyField.mockReset();
        });

        function renderTable(fields: PropertyField[]) {
            getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

            renderWithContext(
                <div>
                    <GlobalAttributesTable/>
                    <ModalController/>
                </div>,
                getBaseState(),
            );
        }

        async function openDeleteModal(fieldId = 'field-1') {
            await userEvent.click(await screen.findByTestId(`global-attribute-actions-${fieldId}`));

            const del = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes('Delete attribute'));
            await userEvent.click(del!);
        }

        it('names the attribute in the confirmation modal instead of deleting straight from the menu', async () => {
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();

            expect(await screen.findByRole('heading', {name: /delete department attribute/i})).toBeInTheDocument();

            // * Opening the modal alone must not have fired the destructive call
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('leaves the row and the API untouched when the modal is cancelled', async () => {
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /cancel/i}));

            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(screen.getByTestId('global-attribute-name')).toHaveTextContent('Department');
        });

        it('deletes via the access_control/template scope and drops the row on success', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-1');
            });

            // * The row is gone because the reducer removed the field, not because the
            // component hid it locally — the last-attribute empty state proves the store changed
            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
        });

        it('surfaces a generic banner above the table and keeps the row when the delete fails', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const banner = await screen.findByTestId('global-attributes-delete-error');
            expect(banner).toHaveTextContent('An error occurred while deleting this attribute. Please try again.');

            // * The row survives a failed delete
            expect(screen.getByTestId('global-attribute-name')).toHaveTextContent('Department');
        });

        it('explains the blocking dependency rather than showing the generic error on a 409', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(409));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const banner = await screen.findByTestId('global-attributes-delete-error');
            expect(banner).toHaveTextContent(/other attributes are still linked to it/i);
            expect(banner).not.toHaveTextContent('An error occurred while deleting this attribute');
        });

        it('dismisses the error banner without re-running the delete', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const banner = await screen.findByTestId('global-attributes-delete-error');

            // The modal aria-hides the page behind it, so wait for it to tear down before
            // reaching for the banner's own dismiss control by role
            await waitFor(() => {
                expect(screen.queryByText(/permanently remove its definition/i)).not.toBeInTheDocument();
            });

            await userEvent.click(within(banner).getByRole('button', {name: /close/i}));

            expect(screen.queryByTestId('global-attributes-delete-error')).not.toBeInTheDocument();
            expect(deletePropertyField).toHaveBeenCalledTimes(1);
        });

        it('keeps the error live region mounted so the banner is announced when it appears', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            // * The region exists before any error, so the banner arriving is a content
            // change inside a live region rather than a newly-inserted region — the
            // latter is not reliably announced
            const liveRegion = await screen.findByRole('alert');
            expect(liveRegion).toBeEmptyDOMElement();

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            // * The node captured before the error now carries the message. A region
            // remounted alongside its content would have left this reference detached
            // and empty, so this also proves the region persisted.
            await waitFor(() => {
                expect(liveRegion).toHaveTextContent('An error occurred while deleting this attribute');
            });
            expect(liveRegion).toBeInTheDocument();
        });

        it('keeps Delete disabled with a reason on a plugin-owned row', async () => {
            renderTable([makeField({attrs: {display_name: 'Department', source_plugin_id: 'com.acme.plugin', protected: true}})]);

            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));

            const del = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes('Delete attribute'));
            expect(del!).toHaveAttribute('aria-disabled', 'true');
            expect(del!).toHaveTextContent('Plugin-managed');

            // pointerEventsCheck: 0 forces the click past the disabled item's
            // `pointer-events: none`, proving no handler is wired underneath the styling
            await userEvent.click(del!, {pointerEventsCheck: 0});

            // * No modal, no API call — the disabled item is inert, not just styled as disabled
            expect(screen.queryByRole('heading', {name: /delete department attribute/i})).not.toBeInTheDocument();
            expect(deletePropertyField).not.toHaveBeenCalled();
        });
    });

    describe('Classification Markings row', () => {
        it('renders the subtitle and an open-in-new link (not the dot-menu) when the field matches and the destination is reachable', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            expect(await screen.findByTestId('global-attribute-classification-subtitle-field-1')).toHaveTextContent('Read-only');

            const link = screen.getByTestId('global-attribute-classification-link-field-1');
            expect(link).toHaveAttribute('href', CLASSIFICATIONS_MARKINGS_ADMIN_URL);
            expect(link).toHaveAccessibleName('Open Classification Markings');

            // * The dot-menu is not rendered for this row
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();

            // * The Source column also identifies this row's true source, rather than the
            // generic "Managed here" every other native field gets
            expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Classification Markings');
        });

        it('renders the ordinary dot-menu, no subtitle, and the generic "Managed here" source when the field matches but the destination is not reachable (flag off / sub-Enterprise)', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            // getBaseState() has no license/FeatureFlags set, so the reachability check is false.
            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).toBeInTheDocument();

            expect(screen.queryByTestId('global-attribute-classification-subtitle-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed here');
        });

        it('renders the ordinary dot-menu when the license is sufficient but the ClassificationMarkings flag is off', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({classificationMarkingsFlagOn: false}));

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).toBeInTheDocument();

            expect(screen.queryByTestId('global-attribute-classification-subtitle-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
        });

        it('renders the ordinary dot-menu when the ClassificationMarkings flag is on but the license is sub-Enterprise', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({licenseSku: 'professional'}));

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).toBeInTheDocument();

            expect(screen.queryByTestId('global-attribute-classification-subtitle-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
        });

        it('renders the open-in-new link on mobile with its tooltip disabled', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getMobileState());

            const link = await screen.findByTestId('global-attribute-classification-link-field-1');
            expect(link).toHaveAttribute('href', CLASSIFICATIONS_MARKINGS_ADMIN_URL);
            expect(link).toHaveAccessibleName('Open Classification Markings');

            // * The tooltip never opens on mobile, even after hovering and waiting past its
            // normal open delay — proves `disabled={isMobileView}` is actually wired up, not
            // just that the link itself renders (which the assertions above already cover).
            await userEvent.hover(link);
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('leaves an unrelated field (not matching name/object_type/group_id) entirely unaffected even when the destination is reachable', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'rank'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).toBeInTheDocument();

            expect(screen.queryByTestId('global-attribute-classification-subtitle-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
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

    it('follows the ticket order: plugin, then both, then ldap, then saml, then managed', () => {
        expect(getSourceKind(makeField({attrs: {ldap: 'x', saml: 'y'}}))).toBe('ldap_and_saml');
        expect(getSourceKind(makeField({attrs: {ldap: 'x'}}))).toBe('ldap');
        expect(getSourceKind(makeField({attrs: {saml: 'y'}}))).toBe('saml');
        expect(getSourceKind(makeField({attrs: {}}))).toBe('managed');
    });
});

describe('isClassificationMarkingsField', () => {
    const groupId = 'accesscontrolgroupuuid001';

    it('returns true only when name, object_type, and group_id all match', () => {
        const field = makeField({name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME, object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(true);
    });

    it('returns false when the name matches but object_type does not', () => {
        const field = makeField({name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME, object_type: 'system', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when the name and object_type match but group_id does not', () => {
        const field = makeField({name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME, object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, group_id: 'some-other-group'});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when object_type and group_id match but the name does not', () => {
        const field = makeField({name: 'not_classification', object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });
});
