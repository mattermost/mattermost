// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor, within} from '@testing-library/react';
import React from 'react';

import {ClientError} from '@mattermost/client';
import {ChevronDownCircleOutlineIcon, FormatListBulletedIcon, LinkVariantIcon, MenuVariantIcon, PoundIcon, PowerPlugOutlineIcon, SitemapIcon, SortAscendingIcon, SyncIcon} from '@mattermost/compass-icons/components';
import type {GlobalAttributeListing, GlobalAttributeListingRow, GlobalAttributeResourceType} from '@mattermost/types/global_attributes';
import type {PropertyField} from '@mattermost/types/properties';
import type {PropertyFieldOwner} from '@mattermost/types/properties_user';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {getPropertyFieldSyncSources} from 'mattermost-redux/utils/property_utils';

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

const mockHistoryPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: mockHistoryPush,
    }),
}));

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

// State where the Classification Markings admin page is actually reachable: Enterprise
// Advanced license (matching admin_definition.tsx's minLicenseTier(EnterpriseAdvanced)
// check) and the ClassificationMarkings feature flag on, read from the same entities/admin
// config tree the route rule itself reads. Both conditions default to "reachable" but can
// be independently overridden to exercise the AND logic off the all-true/all-false diagonal
// (e.g. license ok but flag off, or vice versa).
function getReachableState(overrides: {licenseSku?: string; classificationMarkingsFlagOn?: boolean; channelAttributesFlagOn?: boolean} = {}): DeepPartial<GlobalState> {
    const {licenseSku = 'advanced', classificationMarkingsFlagOn = true, channelAttributesFlagOn = true} = overrides;
    const state = getBaseState();
    state.entities!.general = {
        license: {IsLicensed: 'true', SkuShortName: licenseSku},
    } as EntitiesPartial['general'];
    state.entities!.admin = {
        config: {FeatureFlags: {ClassificationMarkings: classificationMarkingsFlagOn, ChannelAttributes: channelAttributesFlagOn}},
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

type RowInput = PropertyField | GlobalAttributeListingRow;

// A listing row the way the server composes it from a field alone: what the
// listing derives from other fields (an owning template's linked children) is
// passed as overrides.
function makeRow(field: PropertyField, overrides: Partial<GlobalAttributeListingRow> = {}): GlobalAttributeListingRow {
    return {
        field,
        applies_to: field.object_type === 'template' ? [] : [field.object_type as GlobalAttributeResourceType],
        owners: Array.isArray(field.attrs?.owners) ? field.attrs.owners as PropertyFieldOwner[] : [],
        source_kind: getSourceKind(field),
        sync_sources: getPropertyFieldSyncSources(field),
        is_classification: isClassificationMarkingsField(field, ACCESS_CONTROL_GROUP_UUID),
        ...overrides,
    };
}

function makeListing(items: RowInput[]): GlobalAttributeListing {
    return {rows: items.map((item) => ('field' in item ? item : makeRow(item)))};
}

describe('GlobalAttributesTable', () => {
    const searchGlobalAttributes = jest.spyOn(Client4, 'searchGlobalAttributes');

    // The first response carries the rows; any later request (a refetch after a
    // delete) finds the listing empty.
    function mockListing(items: RowInput[]) {
        searchGlobalAttributes.mockResolvedValueOnce(makeListing(items)).mockResolvedValue(makeListing([]));
    }

    beforeEach(() => {
        searchGlobalAttributes.mockReset();
        mockHistoryPush.mockReset();
        jest.spyOn(Client4, 'getPluginStatuses').mockRejectedValue(new Error('network'));
    });

    // Plugin-owned rows fetch plugin statuses after first paint. That update
    // remounts the actions menu if it is already open, so wait it out first.
    async function openActionsMenu(fieldId = 'field-1') {
        const trigger = await screen.findByTestId(`global-attribute-actions-${fieldId}`);
        await waitFor(() => expect(Client4.getPluginStatuses).toHaveBeenCalled());
        await act(async () => {
            await Promise.resolve();
        });
        await userEvent.click(trigger);
        return screen.findAllByRole('menuitem');
    }

    it('shows the loading state before fields resolve', async () => {
        mockListing([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        });
    });

    it('requests the listing with no term', async () => {
        mockListing([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await waitFor(() => {
            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
        });
        expect(searchGlobalAttributes).toHaveBeenCalledWith({term: undefined});
    });

    it('keeps the loading screen, not the empty state, until the listing resolves', async () => {
        let resolveListing: (value: GlobalAttributeListing) => void = () => {};
        searchGlobalAttributes.mockReturnValue(new Promise((resolve) => {
            resolveListing = resolve;
        }));

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

        await act(async () => {
            resolveListing(makeListing([makeField({name: 'department'})]));
        });

        expect(await screen.findByText('department')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
    });

    it('renders one row per returned field, including fields under a real group UUID', async () => {
        const fields = [
            makeField({id: 'f1', name: 'first_field', attrs: {display_name: 'First Field'}}),
            makeField({id: 'f2', name: 'second_field'}),
        ];
        mockListing(fields);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('First Field')).toBeInTheDocument();
        expect(screen.getByText('second_field')).toBeInTheDocument();
    });

    it('falls back to the field name when no display_name is set', async () => {
        mockListing([makeField({name: 'no_display_name', attrs: {}})]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('no_display_name')).toBeInTheDocument();
    });

    it('renders rows in the order the server returned them rather than re-sorting', async () => {
        mockListing([
            makeField({id: 'f1', name: 'zeta_field'}),
            makeField({id: 'f2', name: 'alpha_field'}),
        ]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await screen.findByText('zeta_field');
        const names = screen.getAllByTestId('global-attribute-name').map((cell) => cell.textContent);
        expect(names).toEqual(['zeta_field', 'alpha_field']);
    });

    describe('Non-template fields', () => {
        it('lists an unlinked field from each resource scope alongside templates, applying to its own resource', async () => {
            mockListing([
                makeField({id: 't1', name: 'template_field'}),
                makeField({id: 'u1', name: 'user_field', object_type: 'user'}),
                makeField({id: 'c1', name: 'channel_field', object_type: 'channel'}),
                makeField({id: 'p1', name: 'post_field', object_type: 'post'}),
            ]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByText('user_field')).toBeInTheDocument();
            expect(screen.getByText('template_field')).toBeInTheDocument();
            expect(screen.getByText('channel_field')).toBeInTheDocument();
            expect(screen.getByText('post_field')).toBeInTheDocument();
            expect(screen.getAllByTestId('global-attribute-applies-to').map((cell) => cell.textContent)).toEqual(['—', 'Users', 'Channels', 'Posts']);
        });

        it('does not show the empty state when only non-template fields exist', async () => {
            mockListing([makeField({id: 'u1', name: 'user_field', object_type: 'user'})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByText('user_field')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();
        });
    });

    it('renders the Applies-to column as an explicit placeholder when nothing is linked', async () => {
        mockListing([makeField()]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await waitFor(() => {
            expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('—');
        });
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    it('renders Applies-to chips for the resources a template is linked to', async () => {
        mockListing([makeRow(makeField({id: 'template-1', name: 'department'}), {applies_to: ['user', 'post']})]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        const appliesTo = await screen.findByTestId('global-attribute-applies-to');
        expect(appliesTo).toHaveTextContent('Users');
        expect(appliesTo).toHaveTextContent('Posts');
        expect(appliesTo).not.toHaveTextContent('Channels');
        expect(appliesTo).not.toHaveTextContent('—');
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    it('renders an ordinary row\'s name without a classification subtitle', async () => {
        mockListing([makeField()]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        const nameCell = await screen.findByTestId('global-attribute-name');
        expect(nameCell).toHaveClass('GlobalAttributesTable__name');
        expect(screen.queryByText('Definition is read-only')).not.toBeInTheDocument();
    });

    it('shows the empty-state message when there are no fields', async () => {
        searchGlobalAttributes.mockResolvedValue(makeListing([]));

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
    });

    describe('Search', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        const advance = (ms: number) => act(async () => {
            await jest.advanceTimersByTimeAsync(ms);
        });

        it('sends the search query to the server as the term, after the debounce', async () => {
            mockListing([makeField({id: 'f1', name: 'clearance', attrs: {display_name: 'Clearance'}})]);

            const {rerender} = renderWithContext(<GlobalAttributesTable/>, getBaseState());
            await advance(0);
            expect(await screen.findByText('Clearance')).toBeInTheDocument();

            searchGlobalAttributes.mockClear();
            searchGlobalAttributes.mockResolvedValue(makeListing([makeField({id: 'f1', name: 'clearance', attrs: {display_name: 'Clearance'}})]));
            rerender(<GlobalAttributesTable searchQuery='clear'/>);

            await advance(299);
            expect(searchGlobalAttributes).not.toHaveBeenCalled();

            await advance(1);
            expect(searchGlobalAttributes).toHaveBeenCalledWith({term: 'clear'});
            expect(await screen.findByText('Clearance')).toBeInTheDocument();
        });

        it('shows a no-match state, not the empty state, when a search returns no rows', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));

            renderWithContext(<GlobalAttributesTable searchQuery='zzz'/>, getBaseState());
            await advance(0);

            expect(await screen.findByTestId('global-attributes-empty-search')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();
        });

        it('offers Clear filters from the no-match state of a search', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));
            const onClearFilters = jest.fn();

            renderWithContext(
                <GlobalAttributesTable
                    searchQuery='zzz'
                    onClearFilters={onClearFilters}
                />,
                getBaseState(),
            );
            await advance(0);

            expect(await screen.findByTestId('global-attributes-empty-search')).toHaveTextContent('No attributes match your search.');
            await act(async () => {
                screen.getByRole('button', {name: 'Clear filters'}).click();
            });
            expect(onClearFilters).toHaveBeenCalledTimes(1);
        });

        it('shows the filtered no-match state, not the empty state, when only a source is set', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));
            const onClearFilters = jest.fn();

            renderWithContext(
                <GlobalAttributesTable
                    source='ldap'
                    onClearFilters={onClearFilters}
                />,
                getBaseState(),
            );
            await advance(0);

            expect(await screen.findByTestId('global-attributes-empty-search')).toHaveTextContent('No attributes match your search or filters.');
            expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

            await act(async () => {
                screen.getByRole('button', {name: 'Clear filters'}).click();
            });
            expect(onClearFilters).toHaveBeenCalledTimes(1);
        });

        it('keeps the plain empty state, without Clear filters, when nothing is searched or filtered', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));

            renderWithContext(<GlobalAttributesTable onClearFilters={jest.fn()}/>, getBaseState());
            await advance(0);

            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Clear filters'})).not.toBeInTheDocument();
        });

        it('sends the source with the term', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));

            renderWithContext(
                <GlobalAttributesTable
                    searchQuery='dep'
                    source='saml'
                />,
                getBaseState(),
            );
            await advance(300);

            expect(searchGlobalAttributes).toHaveBeenLastCalledWith({term: 'dep', source: 'saml'});
        });

        it('shows the filtered no-match state, not the empty state, when only a resource type is set', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));
            const onClearFilters = jest.fn();

            renderWithContext(
                <GlobalAttributesTable
                    resourceType='channel'
                    onClearFilters={onClearFilters}
                />,
                getBaseState(),
            );
            await advance(0);

            expect(await screen.findByTestId('global-attributes-empty-search')).toHaveTextContent('No attributes match your search or filters.');
            expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

            await act(async () => {
                screen.getByRole('button', {name: 'Clear filters'}).click();
            });
            expect(onClearFilters).toHaveBeenCalledTimes(1);
        });

        it('sends the resource type with the term and source', async () => {
            searchGlobalAttributes.mockResolvedValue(makeListing([]));

            renderWithContext(
                <GlobalAttributesTable
                    searchQuery='dep'
                    source='saml'
                    resourceType='post'
                />,
                getBaseState(),
            );
            await advance(300);

            expect(searchGlobalAttributes).toHaveBeenLastCalledWith({term: 'dep', source: 'saml', resource_type: 'post'});
        });

        it('keeps showing the rows it has while the next search is in flight', async () => {
            mockListing([makeField({id: 'f1', name: 'clearance', attrs: {display_name: 'Clearance'}})]);

            const {rerender} = renderWithContext(<GlobalAttributesTable/>, getBaseState());
            await advance(0);
            expect(await screen.findByText('Clearance')).toBeInTheDocument();

            searchGlobalAttributes.mockReturnValue(new Promise(() => {}));
            rerender(<GlobalAttributesTable searchQuery='x'/>);
            await advance(300);

            expect(searchGlobalAttributes).toHaveBeenCalledWith(expect.objectContaining({term: 'x'}));
            expect(screen.getByText('Clearance')).toBeInTheDocument();
            expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        });
    });

    describe('Row click', () => {
        it('opens the edit page when a managed row is clicked', async () => {
            mockListing([makeField()]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await userEvent.click(await screen.findByTestId('global-attribute-name'));

            expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
        });

        it('does not navigate when the actions menu is opened', async () => {
            mockListing([makeField()]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));

            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('opens the classification edit page when a classification row is clicked', async () => {
            mockListing([makeClassificationField()]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            await userEvent.click(await screen.findByTestId('global-attribute-name'));

            expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/classification');
        });

        it('opens Classification Markings when a classification row is clicked but its edit page is hidden', async () => {
            mockListing([makeClassificationField()]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({channelAttributesFlagOn: false}));

            await userEvent.click(await screen.findByTestId('global-attribute-name'));

            expect(mockHistoryPush).toHaveBeenCalledWith(CLASSIFICATIONS_MARKINGS_ADMIN_URL);
        });
    });

    it('shows an error state (not the empty state) when the fetch fails', async () => {
        // Suppress the expected console.error from the load failure this test triggers.
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        searchGlobalAttributes.mockRejectedValue(new Error('boom'));

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-error')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('shows an error state (not the empty state) on a 404, rather than treating it as an empty result', async () => {
        // Suppress the expected console.error from the load failure this test triggers.
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const notFound = Object.assign(new Error('not found'), {status_code: 404});
        searchGlobalAttributes.mockRejectedValue(notFound);

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
            ['graph', 'Hierarchical'],
        ])('renders the %s type with the %s label and a leading icon', async (type, label) => {
            mockListing([makeField({type: type as PropertyField['type']})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent(label);
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it.each([
            ['phone', 'Phone'],
            ['url', 'URL'],
            ['email', 'Email'],
        ])('renders a text field with value_type %s as %s', async (valueType, label) => {
            mockListing([makeField({type: 'text', attrs: {value_type: valueType}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent(label);
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('renders a defined fallback (not a blank cell) for a FieldType outside text/select/multiselect/rank/graph', async () => {
            mockListing([makeField({type: 'date'})]);

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
            ['graph', SitemapIcon],
            ['phone', PoundIcon],
            ['url', LinkVariantIcon],
            ['date', MenuVariantIcon],
        ])('maps the %s field type to the expected icon component', (type, icon) => {
            expect(getTypeIcon(type as PropertyField['type'])).toBe(icon);
        });
    });

    describe('Options column', () => {
        it('renders "Free Text" for a text field', async () => {
            mockListing([makeField({type: 'text'})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('Free Text');
        });

        it('renders the option count for a select field', async () => {
            mockListing([makeField({
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'A'}, {id: 'o2', name: 'B'}, {id: 'o3', name: 'C'}]},
            })]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('3 options');
        });

        it('renders an explicit zero-count rather than a blank cell', async () => {
            mockListing([makeField({type: 'multiselect', attrs: {options: []}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('0 options');
        });

        it('uses the singular "1 option" at the pluralization boundary, not "1 options"', async () => {
            mockListing([makeField({
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'A'}]},
            })]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('1 option');
            expect(screen.queryByText('1 options')).not.toBeInTheDocument();
        });

        it('renders the option count for a graph field, not Free Text', async () => {
            mockListing([makeField({
                type: 'graph',
                attrs: {
                    options: [
                        {id: 'o1', name: 'Root', parents: []},
                        {id: 'o2', name: 'Child', parents: ['Root']},
                    ],
                },
            })]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');
            expect(cell).toHaveTextContent('2 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('renders an explicit zero-count for a graph field with no inline options, not Free Text', async () => {
            mockListing([makeField({
                type: 'graph',
                attrs: {options: []},
            })]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');
            expect(cell).toHaveTextContent('0 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('uses options_count when options_omitted is set, never 0 options or Free Text', async () => {
            mockListing([makeField({
                type: 'graph',
                attrs: {
                    options: [],
                    options_omitted: true,
                    options_count: 1500,
                },
            })]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');

            // ICU formats 1500 as 1,500; exact text so "0 options" is not a substring false-positive.
            expect(cell.textContent).toBe('1,500 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('uses options_count when options_omitted and the options key is absent', async () => {
            mockListing([makeField({
                type: 'graph',
                attrs: {
                    options_omitted: true,
                    options_count: 1500,
                },
            })]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');
            expect(cell.textContent).toBe('1,500 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('renders a zero count for a graph field with no options loaded', async () => {
            mockListing([makeField({type: 'graph', attrs: {}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('0 options');
        });
    });

    describe('Source column', () => {
        it('resolves the plugin display name when source_plugin_id + protected are set', async () => {
            mockListing([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]);

            const state = getBaseState();
            state.plugins = {
                plugins: {
                    'com.example.plugin': {id: 'com.example.plugin', name: 'Example Plugin', version: '1.0.0', webapp: {bundle_path: ''}},
                },
            } as DeepPartial<GlobalState>['plugins'];

            renderWithContext(<GlobalAttributesTable/>, state);

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Example Plugin');

            // PowerPlugOutlineIcon's path contains newlines; jest-dom's
            // toBeInTheDocument() does not treat that SVG node as in-document.
            expect(cell.firstElementChild?.nodeName.toLowerCase()).toBe('svg');
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
            mockListing([makeField({
                attrs: {source_plugin_id: 'com.mattermost.gahelper', protected: true},
            })]);

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

            mockListing([makeField({attrs: {ldap: 'someAttribute'}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await screen.findByTestId('global-attribute-source');

            expect(getPluginStatuses).not.toHaveBeenCalled();

            getPluginStatuses.mockRestore();
        });

        describe('owned attributes', () => {
            // A template's owners are those of its linked user field, which the
            // listing composes into the row.
            const mockTemplateWithOwners = (owners: PropertyFieldOwner[]) => {
                mockListing([makeRow(makeField({id: 'template-1', name: 'department'}), {applies_to: ['user'], owners})]);
            };

            it('names a plugin owner from the admin plugin statuses on a template row', async () => {
                const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([{
                    plugin_id: 'com.mattermost.scim',
                    name: 'SCIM',
                    description: '',
                    version: '1.0.0',
                    cluster_id: '',
                    plugin_path: '',
                    state: 1,
                }]);
                mockTemplateWithOwners([{id: 'com.mattermost.scim', type: 'plugin', scopes: []}]);

                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by SCIM');
                });
                expect(screen.getByTestId('global-attribute-source').querySelector('svg')).toBeInTheDocument();

                getPluginStatuses.mockRestore();
            });

            it('names the owners of a standalone user attribute', async () => {
                mockListing([makeField({
                    id: 'user-1',
                    name: 'standalone',
                    object_type: 'user',
                    attrs: {owners: [{id: 'svc-sync', type: 'service', scopes: []}]},
                })]);

                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by svc-sync');
                });
            });

            it('shows the owner alongside an LDAP/SAML link on a standalone user attribute, without scopes', async () => {
                mockListing([makeField({
                    id: 'user-1',
                    name: 'standalone',
                    object_type: 'user',
                    attrs: {saml: 'dept', owners: [{id: 'svc-sync', type: 'service', scopes: ['local']}]},
                })]);

                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by svc-sync');
                });
                expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('SAML');
                expect(screen.getByTestId('global-attribute-source')).not.toHaveTextContent('local');
            });

            it('lists every owner in stored order', async () => {
                mockTemplateWithOwners([
                    {id: 'svc-b', type: 'service', scopes: []},
                    {id: 'svc-a', type: 'service', scopes: []},
                ]);

                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by svc-b and svc-a');
                });
            });

            it('still reads "Managed here" when the linked user field has no owners', async () => {
                mockTemplateWithOwners([]);

                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('Users');
                });
                expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed here');
            });
        });

        it('shows AD/LDAP when attrs.ldap is set', async () => {
            mockListing([makeField({attrs: {ldap: 'someAttribute'}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('AD/LDAP');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows SAML when attrs.saml is set', async () => {
            mockListing([makeField({attrs: {saml: 'someAttribute'}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('SAML');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows "AD/LDAP, SAML" when both attrs.ldap and attrs.saml are set', async () => {
            mockListing([makeField({attrs: {ldap: 'employeeID', saml: 'position'}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('AD/LDAP, SAML');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows OpenID Connect when attrs.openid is set', async () => {
            mockListing([makeField({attrs: {openid: 'address.country'}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('OpenID Connect');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('falls back to "Managed here" (no icon) when no source signal is present', async () => {
            mockListing([makeField({attrs: {}})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Managed here');
            expect(cell.querySelector('svg')).not.toBeInTheDocument();
        });

        it.each([
            ['plugin', PowerPlugOutlineIcon],
            ['external', SyncIcon],
        ])('maps the %s source kind to the expected icon component', (kind, icon) => {
            expect(getSourceIcon(kind as ReturnType<typeof getSourceKind>)).toBe(icon);
        });

        it('maps the managed source kind to no icon', () => {
            expect(getSourceIcon('managed')).toBeUndefined();
        });
    });

    describe('Actions column', () => {
        it('opens the menu with Edit and Delete enabled for a managed field', async () => {
            mockListing([makeField()]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).not.toBeDisabled();

            // * Icon-only trigger has an accessible name for screen readers (WCAG 4.1.2)
            expect(trigger).toHaveAccessibleName('More actions');

            await userEvent.click(trigger);

            const menuitems = screen.getAllByRole('menuitem');
            const edit = menuitems.find((el) => el.textContent?.includes('Edit attribute'));
            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));

            expect(edit).toBeDefined();
            expect(del).toBeDefined();
            expect(menuitems.find((el) => el.textContent?.includes('Duplicate attribute'))).toBeUndefined();

            expect(edit!).not.toHaveAttribute('aria-disabled', 'true');
            expect(del!).not.toHaveAttribute('aria-disabled', 'true');

            await userEvent.click(edit!);
            await waitFor(() => {
                expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
            });
        });

        it('enables View (not Edit) and navigates to the edit page for a plugin-owned row (the edit page itself now handles the read-only rendering)', async () => {
            mockListing([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]);

            const state = getBaseState();
            state.entities!.admin = {
                pluginStatuses: {'com.example.plugin': {id: 'com.example.plugin'}},
            } as EntitiesPartial['admin'];

            renderWithContext(<GlobalAttributesTable/>, state);

            const menuitems = await openActionsMenu();
            expect(menuitems.find((el) => el.textContent?.includes('Edit attribute'))).toBeUndefined();

            const view = menuitems.find((el) => el.textContent?.includes('View attribute'));
            expect(view).not.toHaveAttribute('aria-disabled', 'true');

            await userEvent.click(view!);
            await waitFor(() => {
                expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
            });
        });

        it('leaves Delete\'s orphan-aware gating unaffected on a plugin-owned row', async () => {
            mockListing([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]);

            const state = getBaseState();
            state.entities!.admin = {
                pluginStatuses: {'com.example.plugin': {id: 'com.example.plugin'}},
            } as EntitiesPartial['admin'];

            renderWithContext(<GlobalAttributesTable/>, state);

            const menuitems = await openActionsMenu();
            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));

            expect(menuitems.find((el) => el.textContent?.includes('Duplicate attribute'))).toBeUndefined();

            // Plugin is installed (pluginStatuses has an entry) -- Delete stays
            // plugin-managed/disabled, same as before this change.
            expect(del).toHaveAttribute('aria-disabled', 'true');
            expect(del).toHaveTextContent('Plugin-managed');
        });

        it('opens Edit for a graph field, same as any other managed type', async () => {
            mockListing([makeField({type: 'graph'})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            await userEvent.click(trigger);

            const edit = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes('Edit attribute'));
            expect(edit).toBeDefined();
            expect(edit!).not.toHaveAttribute('aria-disabled', 'true');
            expect(edit!).not.toHaveTextContent('Coming soon');
        });

        it('offers View and disables Delete when the listing page is read-only', async () => {
            mockListing([makeField()]);

            renderWithContext(<GlobalAttributesTable disabled={true}/>, getBaseState());

            // Managed rows never fetch plugin statuses, so open the menu directly
            // rather than via openActionsMenu (which waits on that fetch).
            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));
            const menuitems = screen.getAllByRole('menuitem');
            expect(menuitems.find((el) => el.textContent?.includes('Edit attribute'))).toBeUndefined();

            const view = menuitems.find((el) => el.textContent?.includes('View attribute'));
            expect(view).not.toHaveAttribute('aria-disabled', 'true');

            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));
            expect(del).toHaveAttribute('aria-disabled', 'true');

            await userEvent.click(view!);
            await waitFor(() => {
                expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
            });
        });
    });

    describe('Delete action', () => {
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

        beforeEach(() => {
            deletePropertyField.mockReset();
        });

        // The class here is not decoration: the System Console scrolls in
        // .admin-console__wrapper, and that is the ancestor the table pulls back to
        // the top when a delete fails. jsdom implements no scrolling at all, so the
        // method is stubbed to record the call.
        function renderTable(fields: PropertyField[], state: DeepPartial<GlobalState> = getBaseState()) {
            mockListing(fields);

            renderWithContext(
                <div className='admin-console__wrapper'>
                    <GlobalAttributesTable/>
                    <ModalController/>
                </div>,
                state,
            );

            const scrollTo = jest.fn();
            Object.assign(document.querySelector('.admin-console__wrapper')!, {scrollTo});

            return {scrollTo};
        }

        // A plugin-owned row is server-protected only while its plugin is still
        // installed, so these tests have to state which plugins the admin console
        // believes are installed. Without this the row reads as orphaned.
        function getStateWithInstalledPlugin(pluginId: string): DeepPartial<GlobalState> {
            const state = getBaseState();
            state.entities!.admin = {
                pluginStatuses: {[pluginId]: {id: pluginId}},
            } as EntitiesPartial['admin'];
            return state;
        }

        const PLUGIN_ID = 'com.acme.plugin';

        function makePluginOwnedField() {
            return makeField({attrs: {display_name: 'Department', source_plugin_id: PLUGIN_ID, protected: true}});
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

        it('deletes a non-template field via its own object type scope', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});

            mockListing([makeField({id: 'c1', name: 'channel_field', object_type: 'channel', attrs: {display_name: 'Channel Field'}})]);

            renderWithContext(
                <div className='admin-console__wrapper'>
                    <GlobalAttributesTable/>
                    <ModalController/>
                </div>,
                getBaseState(),
            );

            await openDeleteModal('c1');
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'channel', 'c1');
            });
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

        it('scrolls the page back to the top and takes focus once a failed delete has closed the modal', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const liveRegion = await screen.findByRole('alert');

            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledWith({top: 0});
            });

            // * Focus lands on the banner rather than being restored to the row's
            // actions button, which is what would otherwise scroll the page away
            // from the error again
            expect(liveRegion).toHaveFocus();
        });

        it('still scrolls to the error when the delete outlasts the modal close animation', async () => {
            // GenericModal starts closing before it calls handleConfirm, so a slow
            // request can land after the modal is already gone — the reverse of the
            // usual order, and the case a plain onExited hook would miss
            let failDelete: (error: unknown) => void = () => {};
            deletePropertyField.mockImplementation(() => new Promise((_resolve, reject) => {
                failDelete = reject;
            }));

            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(screen.queryByText(/permanently remove its definition/i)).not.toBeInTheDocument();
            });
            expect(scrollTo).not.toHaveBeenCalled();

            await act(async () => {
                failDelete(makeClientError(500));
            });

            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledWith({top: 0});
            });
        });

        it('leaves the scroll position alone when the delete succeeds', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
            expect(scrollTo).not.toHaveBeenCalled();
        });

        it('leaves the scroll position alone when the modal is cancelled', async () => {
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /cancel/i}));

            await waitFor(() => {
                expect(screen.queryByText(/permanently remove its definition/i)).not.toBeInTheDocument();
            });
            expect(scrollTo).not.toHaveBeenCalled();
        });

        it('keeps scrolling to the error on a second failed delete', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));
            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledTimes(1);
            });

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            // * The behaviour is per-attempt rather than one-shot. Note this does not
            // pin down *when* the second scroll fires: jsdom completes the modal's
            // fade before the rejection lands, so the ordering the component re-arms
            // for is not reproducible here.
            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledTimes(2);
            });
        });

        it('keeps Delete disabled with a reason on a plugin-owned row while the plugin is installed', async () => {
            renderTable([makePluginOwnedField()], getStateWithInstalledPlugin(PLUGIN_ID));

            const del = (await openActionsMenu()).find((el) => el.textContent?.includes('Delete attribute'));
            expect(del!).toHaveAttribute('aria-disabled', 'true');
            expect(del!).toHaveTextContent('Plugin-managed');

            // pointerEventsCheck: 0 forces the click past the disabled item's
            // `pointer-events: none`, proving no handler is wired underneath the styling
            await userEvent.click(del!, {pointerEventsCheck: 0});

            // * No modal, no API call — the disabled item is inert, not just styled as disabled
            expect(screen.queryByRole('heading', {name: /delete department attribute/i})).not.toBeInTheDocument();
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('re-enables Delete on a plugin-owned row once the plugin is uninstalled, so the leftover can be cleaned up', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});

            // No plugin statuses at all: the source plugin is gone, which is what the
            // server itself keys the delete allowance off (checkFieldDeleteAccess)
            renderTable([makePluginOwnedField()]);

            const del = (await openActionsMenu()).find((el) => el.textContent?.includes('Delete attribute'));
            expect(del!).not.toHaveAttribute('aria-disabled', 'true');
            expect(del!).not.toHaveTextContent('Plugin-managed');

            await userEvent.click(del!);

            // * The confirmation names the plugin the leftover came from, since an
            // uninstalled plugin is otherwise invisible to the admin
            expect(await screen.findByRole('heading', {name: /delete department attribute/i})).toBeInTheDocument();
            expect(screen.getByText(/was created by the plugin "com\.acme\.plugin", which is no longer installed/i)).toBeInTheDocument();

            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-1');
            });
        });

        it('treats a plugin-owned row as protected while the plugin inventory is still in flight', async () => {
            // An inventory that has not arrived looks byte-for-byte like a server with
            // the plugin uninstalled, so only the settled fetch tells the two apart.
            // This one never settles, pinning the row in the not-yet-known state; the
            // 're-enables Delete' test above covers the settled side.
            const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').
                mockImplementation(() => new Promise(() => {}));

            renderTable([makePluginOwnedField()]);

            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));

            const del = (await screen.findAllByRole('menuitem')).find((el) => el.textContent?.includes('Delete attribute'));

            // * Without the gate the empty inventory reads as "plugin gone", offering
            // Delete behind a dialog that wrongly says the plugin was uninstalled
            expect(del!).toHaveAttribute('aria-disabled', 'true');
            expect(del!).toHaveTextContent('Plugin-managed');

            getPluginStatuses.mockRestore();
        });

        describe('owned attributes', () => {
            const owner = (id: string, type: PropertyFieldOwner['type'] = 'plugin'): PropertyFieldOwner => ({id, type, scopes: []});

            function mockOwnedTemplate(owners: PropertyFieldOwner[]) {
                mockListing([makeRow(makeField({id: 'template-1', name: 'department'}), {applies_to: ['user'], owners})]);
            }

            function renderOwned(installedPluginId?: string) {
                const state = getBaseState();
                if (installedPluginId) {
                    state.entities!.admin = {pluginStatuses: {[installedPluginId]: {id: installedPluginId}}} as EntitiesPartial['admin'];
                }
                renderWithContext(
                    <>
                        <GlobalAttributesTable/>
                        <ModalController/>
                    </>,
                    state,
                );
            }

            async function clickActionsAndFindDelete(fieldId: string) {
                await userEvent.click(await screen.findByTestId(`global-attribute-actions-${fieldId}`));
                return (await screen.findAllByRole('menuitem')).find((el) => el.textContent?.includes('Delete attribute'))!;
            }

            // Plugin owners trigger the inventory fetch, which remounts an open menu.
            async function findDeleteOnSettledTemplate() {
                await waitFor(() => expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by'));
                await waitFor(() => expect(Client4.getPluginStatuses).toHaveBeenCalled());
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                });
                return clickActionsAndFindDelete('template-1');
            }

            async function expectInertDisabledDelete(del: HTMLElement, reason: string) {
                expect(del).toHaveAttribute('aria-disabled', 'true');
                expect(del).toHaveTextContent(reason);
                await userEvent.click(del, {pointerEventsCheck: 0});
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                expect(deletePropertyField).not.toHaveBeenCalled();
            }

            it('disables Delete with the owner named on a template row whose owner plugin is installed', async () => {
                mockOwnedTemplate([owner('com.acme.scim')]);
                renderOwned('com.acme.scim');

                const del = await findDeleteOnSettledTemplate();
                await expectInertDisabledDelete(del, 'Managed by com.acme.scim');
            });

            it('disables Delete on a standalone user attribute owned by a service', async () => {
                mockListing([makeField({id: 'user-1', name: 'standalone', object_type: 'user', attrs: {owners: [owner('svc-sync', 'service')]}})]);
                renderOwned();

                await expectInertDisabledDelete(await clickActionsAndFindDelete('user-1'), 'Managed by svc-sync');
            });

            it('enables Delete once every owner plugin is uninstalled and confirms naming them', async () => {
                deletePropertyField.mockResolvedValue({status: 'OK'});
                mockOwnedTemplate([owner('com.acme.one'), owner('com.acme.two')]);
                renderOwned();

                const del = await findDeleteOnSettledTemplate();
                expect(del).not.toHaveAttribute('aria-disabled', 'true');
                await userEvent.click(del);

                expect(await screen.findByText(/no longer installed/i)).toHaveTextContent('com.acme.one and com.acme.two');

                await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));
                await waitFor(() => {
                    expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-1');
                });
            });

            it('keeps Delete disabled when an uninstalled plugin shares ownership with a service', async () => {
                mockOwnedTemplate([owner('com.acme.gone'), owner('svc-sync', 'service')]);
                renderOwned();

                const del = await findDeleteOnSettledTemplate();
                await expectInertDisabledDelete(del, 'Managed by');
            });

            it('keeps Delete disabled on an owned row while the plugin inventory is still in flight', async () => {
                const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockImplementation(() => new Promise(() => {}));
                mockOwnedTemplate([owner('com.acme.gone')]);
                renderOwned();

                await waitFor(() => expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by com.acme.gone'));
                expect(await clickActionsAndFindDelete('template-1')).toHaveAttribute('aria-disabled', 'true');

                getPluginStatuses.mockRestore();
            });
        });

        it('omits the plugin explanation for an ordinary attribute', async () => {
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();

            expect(await screen.findByText(/permanently remove its definition/i)).toBeInTheDocument();
            expect(screen.queryByText(/no longer installed/i)).not.toBeInTheDocument();
        });
    });

    describe('Classification Markings row', () => {
        it('renders the subtitle and an open-in-new link with no actions menu when the field matches and the destination is reachable', async () => {
            mockListing([makeClassificationField()]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            expect(await screen.findByTestId('global-attribute-name')).toHaveTextContent('Classification');
            expect(await screen.findByTestId('global-attribute-classification-subtitle-field-1')).toHaveTextContent('Definition is read-only');

            const link = screen.getByTestId('global-attribute-classification-link-field-1');
            expect(link).toHaveAttribute('href', CLASSIFICATIONS_MARKINGS_ADMIN_URL);
            expect(link).toHaveAccessibleName('Open Classification Markings');

            // * The definition is edited on Classification Markings; this row must not
            // offer a duplicate Edit/More-actions menu next to the open-in-new link
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();

            // * The Source column also identifies this row's true source, rather than the
            // generic "Managed here" every other native field gets
            expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Classification Markings');
        });

        it('offers the link alone when ChannelAttributes is off, since the attribute page is hidden then', async () => {
            mockListing([makeClassificationField()]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({channelAttributesFlagOn: false}));

            expect(await screen.findByTestId('global-attribute-classification-link-field-1')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();
        });

        it('renders the open-in-new link on mobile with its tooltip disabled', async () => {
            mockListing([makeClassificationField()]);

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

        it('does not dim the name or subtitle, so a read-only definition does not read as a disabled attribute', async () => {
            mockListing([makeClassificationField(), makeField({id: 'field-2', attrs: {display_name: 'Program'}})]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            const [classificationName, ordinaryName] = await screen.findAllByTestId('global-attribute-name');
            expect(classificationName).toHaveTextContent('Classification');
            expect(ordinaryName).toHaveTextContent('Program');

            // * Dimming the row on top of its "Definition is read-only" subtitle made a
            // correctly configured attribute look disabled
            expect(classificationName.className).toBe(ordinaryName.className);
            expect(screen.getByTestId('global-attribute-classification-subtitle-field-1').className).
                toBe('GlobalAttributesTable__subtitle');
        });

        it('leaves an unrelated field (not matching name/object_type/group_id) entirely unaffected even when the destination is reachable', async () => {
            mockListing([makeField({type: 'rank'})]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).toBeInTheDocument();

            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
        });

        it('treats a wrong-typed template named classification as an ordinary attribute, so it can be repaired', async () => {
            // * An admin can create a text attribute called `classification` here, which
            // the Classification Markings page then reports as a conflict. Deleting or
            // renaming it in this table is the repair path that error points at, so the
            // row must keep its Edit and Delete actions.
            mockListing([makeClassificationField({type: 'text', attrs: {}})]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            expect(await screen.findByTestId('global-attribute-name')).toHaveTextContent('Classification');
            expect(screen.queryByTestId('global-attribute-classification-subtitle-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed here');

            await userEvent.click(screen.getByTestId('global-attribute-actions-field-1'));

            const items = (await screen.findAllByRole('menuitem')).map((el) => el.textContent);
            expect(items).toEqual(['Edit attribute', 'Delete attribute']);
        });
    });

    describe('Name conflict warning', () => {
        const CONFLICT_TESTID = /^global-attribute-name-conflict-/;

        // Rows carry no accessible name of their own, so each assertion is scoped to
        // the <tr> the named Attribute cell sits in — a warning rendered on a
        // neighbouring row cannot then satisfy one of these.
        async function findRowByName(displayName: string): Promise<HTMLElement> {
            const cells = await screen.findAllByTestId('global-attribute-name');
            const cell = cells.find((candidate) => candidate.textContent === displayName);
            expect(cell).toBeDefined();
            return cell!.closest('tr')!;
        }

        // The template an admin creates without knowing that Classification already
        // owns a user field carrying that name. Only the case differs, which is why
        // the server accepted both (its uniqueness check is case-sensitive).
        const clearanceTemplate = makeField({id: 'template-clearance', name: 'Clearance', attrs: {display_name: 'Clearance'}});
        const classificationTemplate = makeField({id: 'template-classification', name: 'classification', attrs: {display_name: 'Classification'}});
        const clearanceUserField = makeField({id: 'user-clearance', name: 'clearance', object_type: 'user', linked_field_id: classificationTemplate.id});

        // The conflict itself is resolved by the server for each row; the
        // table only renders what a row carries.
        const conflictingClearanceRow = () => makeRow(clearanceTemplate, {
            applies_to: ['user'],
            name_conflict: {field: clearanceUserField, owner_template: classificationTemplate, exact: false},
        });

        it('warns on the row the server flags, naming the colliding attribute and the template that owns it', async () => {
            mockListing([conflictingClearanceRow(), makeRow(classificationTemplate, {applies_to: ['user']})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const clearanceRow = await findRowByName('Clearance');
            const warning = within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`);

            // * Both halves of what this row hides: the unique name an admin would
            // write in a CEL rule, and the attribute that name actually resolves to.
            expect(warning).toHaveAccessibleName(/"clearance"/);
            expect(warning).toHaveAccessibleName(/linked to Classification/);

            // * Only the flagged row warns: the owner's own row carries no conflict.
            const classificationRow = await findRowByName('Classification');
            expect(within(classificationRow).queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('leaves every row unwarned when no row carries a name conflict', async () => {
            mockListing([makeRow(clearanceTemplate, {applies_to: ['user']}), makeRow(classificationTemplate, {applies_to: ['user']})]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await findRowByName('Clearance');

            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('names no owner when the colliding user field is standalone', async () => {
            const standaloneClearance = makeField({id: 'user-clearance', name: 'clearance', object_type: 'user'});
            mockListing([
                makeRow(clearanceTemplate, {name_conflict: {field: standaloneClearance, exact: false}}),
                standaloneClearance,
            ]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const clearanceRow = await findRowByName('Clearance');
            const warning = within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`);

            expect(warning).toHaveAccessibleName(/standalone user attribute named "clearance"/);
            expect(warning).not.toHaveAccessibleName(/linked to/);

            // * The standalone user field is the field the warning above describes,
            // so its own row carries no conflict.
            const userFieldRow = await findRowByName('clearance');
            expect(within(userFieldRow).queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('warns on both of two standalone user rows the server reports as conflicting', async () => {
            // A standalone user field gets a row of its own, and the server's
            // case-sensitive uniqueness check let both of these be created, so each
            // is the other's conflict.
            const lower = makeField({id: 'user-clearance-lower', name: 'clearance', object_type: 'user'});
            const upper = makeField({id: 'user-clearance-upper', name: 'Clearance', object_type: 'user'});
            mockListing([
                makeRow(lower, {name_conflict: {field: upper, exact: false}}),
                makeRow(upper, {name_conflict: {field: lower, exact: false}}),
            ]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const lowercaseRow = await findRowByName('clearance');
            expect(within(lowercaseRow).getByTestId('global-attribute-name-conflict-user-clearance-lower')).
                toHaveAccessibleName(/standalone user attribute named "Clearance"/);

            const uppercaseRow = await findRowByName('Clearance');
            expect(within(uppercaseRow).getByTestId('global-attribute-name-conflict-user-clearance-upper')).
                toHaveAccessibleName(/standalone user attribute named "clearance"/);
        });

        describe('warning affordance', () => {
            beforeEach(() => {
                mockListing([conflictingClearanceRow(), makeRow(classificationTemplate, {applies_to: ['user']})]);
            });

            async function findWarning(): Promise<HTMLElement> {
                const clearanceRow = await findRowByName('Clearance');
                return within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`);
            }

            it('reveals the warning on hover, so the mouse path spells out the conflict in full', async () => {
                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                const warning = await findWarning();
                expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

                await userEvent.hover(warning);

                const tooltip = await screen.findByRole('tooltip', {hidden: true}, {timeout: 2000});
                expect(tooltip).toHaveTextContent('A user attribute named "clearance" already exists and is linked to Classification.');
            });

            it('is an icon with a role that admits a name, so it can neither ship invisible nor unannounceable', async () => {
                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                const warning = await findWarning();

                // `img` is what lets aria-label be announced on a span whose only
                // content is decoration. Asserted on the attribute rather than
                // through a query by role, because testing-library computes an
                // accessible name for the label with or without it while real
                // assistive tech does not.
                expect(warning).toHaveAttribute('role', 'img');

                // And there is something to see. Asserted structurally, for the
                // same reason the read-only resource icons are in
                // applies_to_card.test: the icon is aria-hidden and has nothing a
                // query by role or accessible name could find, so without this,
                // deleting it would leave an empty focusable span every other
                // assertion here is happy with.
                const icon = warning.querySelector('svg');
                expect(icon).not.toBeNull();
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            });

            it('takes keyboard focus, so the same warning is reachable without a mouse', async () => {
                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                const warning = await findWarning();

                // Tabbed to from the top of the document rather than focused
                // directly: the icon carries no interactive role of its own, so
                // being a tab stop at all is the affordance.
                for (let tabs = 0; tabs < 20 && document.activeElement !== warning; tabs++) {
                    await userEvent.tab(); // eslint-disable-line no-await-in-loop
                }

                expect(warning).toHaveFocus();

                // * Focus, not just hover, opens the tooltip — a tab stop that
                // revealed nothing would be a dead end.
                const tooltip = await screen.findByRole('tooltip', {hidden: true}, {timeout: 2000});
                expect(tooltip).toHaveTextContent('A user attribute named "clearance" already exists and is linked to Classification.');
            });
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

    it('title-cases the classification template name so the listing matches the edit page', () => {
        expect(getDisplayName(makeClassificationField())).toBe('Classification');
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

    it('follows the ticket order: plugin, then any identity source, then managed', () => {
        expect(getSourceKind(makeField({attrs: {ldap: 'x', saml: 'y'}}))).toBe('external');
        expect(getSourceKind(makeField({attrs: {ldap: 'x'}}))).toBe('external');
        expect(getSourceKind(makeField({attrs: {saml: 'y'}}))).toBe('external');
        expect(getSourceKind(makeField({attrs: {openid: 'z'}}))).toBe('external');
        expect(getSourceKind(makeField({attrs: {ldap: ''}}))).toBe('managed');
        expect(getSourceKind(makeField({attrs: {}}))).toBe('managed');
    });
});

describe('isClassificationMarkingsField', () => {
    const groupId = 'accesscontrolgroupuuid001';

    it('returns true only when name, type, object_type, and group_id all match', () => {
        const field = makeClassificationField({group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(true);
    });

    it('returns false when the name matches but object_type does not', () => {
        const field = makeClassificationField({object_type: 'system', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when the name and object_type match but group_id does not', () => {
        const field = makeClassificationField({group_id: 'some-other-group'});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when object_type and group_id match but the name does not', () => {
        const field = makeClassificationField({name: 'not_classification', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when only the type does not match, so it stays an ordinary attribute', () => {
        const field = makeClassificationField({type: 'text', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });
});
