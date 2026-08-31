// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {pageAllPropertyFieldOptions} from 'components/property_fields/page_all_property_field_options';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

// Every test in this file renders with an empty store, so the graph flag is off
// and the tree must never mount. That is an assumption about another module's
// behaviour, though, and if it ever breaks the widget would call the real pager:
// setup_jest.ts assigns globalThis.fetch = nodeFetch, so it becomes an outbound
// request to localhost, and the widget swallows fetch failures into an error
// status. The test then fails on a missing element with no network error in the
// output -- a destroyed report rather than a named bug.
jest.mock('components/property_fields/page_all_property_field_options', () => ({
    ...jest.requireActual('components/property_fields/page_all_property_field_options'),
    pageAllPropertyFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllPropertyFieldOptions);

beforeEach(() => {
    mockPageAll.mockReset();
    mockPageAll.mockImplementation(() => {
        throw new Error('the flat picker fetched options: the graph tree mounted with the flag off');
    });
});

// A comparable channel attribute the row's user attribute can target instead of
// a literal value. Same shape as a CPA field; object_type marks it a channel
// (resource) attribute.
function channelField(name: string, type: UserPropertyField['type'], displayName: string): UserPropertyField {
    return {
        id: `cf_${name}`,
        name,
        type,
        group_id: 'channel_attributes',
        target_id: '',
        target_type: '',
        object_type: 'channel',
        attrs: {
            sort_order: 0,
            visibility: 'always',
            value_type: '',
            display_name: displayName,
        },
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    } as unknown as UserPropertyField;
}

const selectOptions: PropertyFieldOption[] = [
    {id: 'o1', name: 'engineering'} as PropertyFieldOption,
    {id: 'o2', name: 'sales'} as PropertyFieldOption,
];

function baseRow(overrides: Partial<TableRow> = {}): TableRow {
    return {
        attribute: 'team',
        operator: 'is',
        values: [],
        attribute_type: 'select',
        hasMaskedValues: false,
        ...overrides,
    };
}

describe('ValueSelectorMenu — consolidated value/channel-attribute dropdown', () => {
    const updateValues = jest.fn();
    const onSelectTarget = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('option-based single field with channel targets', () => {
        const owningTeam = channelField('owningTeam', 'select', 'Owning team');

        function renderIt(row: TableRow) {
            renderWithContext(
                <ValueSelectorMenu
                    row={row}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                    channelFields={[owningTeam]}
                    onSelectTarget={onSelectTarget}
                />,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        }

        test('shows both the VALUES options and the CHANNEL ATTRIBUTES section', () => {
            renderIt(baseRow());

            expect(screen.getByText('Values')).toBeInTheDocument();
            expect(screen.getByText('Channel attributes')).toBeInTheDocument();
            expect(screen.getByText('engineering')).toBeInTheDocument();
            expect(screen.getByText('Owning team')).toBeInTheDocument();
        });

        test('picking a value commits a literal value', () => {
            renderIt(baseRow());

            fireEvent.click(screen.getByText('sales'));
            expect(updateValues).toHaveBeenCalledWith(['sales']);
            expect(onSelectTarget).not.toHaveBeenCalled();
        });

        test('picking a channel attribute switches to target mode', () => {
            renderIt(baseRow());

            fireEvent.click(screen.getByText('Owning team'));
            expect(onSelectTarget).toHaveBeenCalledWith('owningTeam');
        });

        test('in target mode the button shows the channel attribute label', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({targetAttribute: 'owningTeam'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                    channelFields={[owningTeam]}
                    onSelectTarget={onSelectTarget}
                />,
            );

            // The button (before opening) renders the target's display label,
            // not a literal value.
            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Owning team');
        });
    });

    describe('text field (no options) with channel targets', () => {
        const owningTeamText = channelField('owningTeamText', 'text', 'Owning team (text)');

        test('renders a free-text input atop the CHANNEL ATTRIBUTES list', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({attribute_type: 'text'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                    channelFields={[owningTeamText]}
                    onSelectTarget={onSelectTarget}
                />,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(screen.getByText('Channel attributes')).toBeInTheDocument();
            expect(screen.getByText('Owning team (text)')).toBeInTheDocument();

            const input = screen.getByRole('textbox');
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'platform'}});
            fireEvent.keyDown(input, {key: 'Enter'});

            expect(updateValues).toHaveBeenCalledWith(['platform']);
        });
    });

    describe('text field with no channel targets', () => {
        test('keeps the legacy bare input (no dropdown, no sections)', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({attribute_type: 'text'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                />,
            );

            expect(screen.queryByTestId('valueSelectorMenuButton')).not.toBeInTheDocument();
            expect(screen.queryByText('Channel attributes')).not.toBeInTheDocument();

            const input = screen.getByRole('textbox');
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'platform'}});
            fireEvent.blur(input);
            expect(updateValues).toHaveBeenCalledWith(['platform']);
        });
    });

    describe('text field in target mode with the target list unavailable', () => {
        test('still shows the channel target instead of a bare input', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({attribute_type: 'text', targetAttribute: 'owningTeamText'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                    onSelectTarget={onSelectTarget}
                />,
            );

            // No options and no channel fields (still loading / feature off /
            // attribute deleted), but the row targets one — falling back to the
            // bare input would hide the target and drop it on the next keystroke.
            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('owningTeamText');
        });
    });

    describe('multiselect field (has any of) with channel targets', () => {
        const programs = channelField('channelPrograms', 'multiselect', 'Channel programs');

        function renderMulti(row: TableRow) {
            renderWithContext(
                <ValueSelectorMenu
                    row={row}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                    channelFields={[programs]}
                    onSelectTarget={onSelectTarget}
                />,
            );
        }

        test('offers both multi-values and the channel attribute', () => {
            renderMulti(baseRow({operator: 'has any of', attribute_type: 'multiselect'}));
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(screen.getByText('engineering')).toBeInTheDocument();
            expect(screen.getByText('Channel programs')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Channel programs'));
            expect(onSelectTarget).toHaveBeenCalledWith('channelPrograms');
        });

        test('in target mode the multiselect button shows the channel attribute label', () => {
            renderMulti(baseRow({operator: 'has any of', attribute_type: 'multiselect', targetAttribute: 'channelPrograms'}));

            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Channel programs');
        });
    });

    describe('no channel targets on an option field', () => {
        test('renders values only, without the CHANNEL ATTRIBUTES section', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow()}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                />,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(screen.getByText('engineering')).toBeInTheDocument();
            expect(screen.queryByText('Channel attributes')).not.toBeInTheDocument();

            // Without a second section the "Values" section header is omitted too.
            expect(screen.queryByText('Values')).not.toBeInTheDocument();
        });
    });

    // The flag is off in all of these -- renderWithContext builds its store from
    // {}, so entities.general.config is empty and useGetFeatureFlagValue returns
    // undefined. That is the point: these pin the flat picker's behaviour on a
    // graph attribute, which is the path where create-value was being offered.
    describe('graph attribute — create-value is never offered', () => {
        // These are the only tests in the file that pass a graph field, so they
        // are the only ones where the tree could mount. Asserted here rather
        // than at file scope because the parent's jest.clearAllMocks() would
        // wipe the call record first: an inner afterEach runs before an outer
        // one, so this still sees the truth.
        afterEach(() => {
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        function graphField(options?: PropertyFieldOption[]): UserPropertyField {
            return {
                id: 'user-programs',
                name: 'programs',
                type: 'graph',
                group_id: 'custom_profile_attributes',
                object_type: 'user',
                target_id: '',
                target_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',

                    // No options and the omitted markers is the >1000 regime, and
                    // it is the one that turned create on: an absent list is
                    // indistinguishable from an option-less attribute.
                    ...(options ? {options} : {options_omitted: true, options_count: 1500}),
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            } as unknown as UserPropertyField;
        }

        const graphRow = (overrides: Partial<TableRow> = {}) => baseRow({
            attribute: 'programs',
            operator: 'coversAll',
            attribute_type: 'graph',
            ...overrides,
        });

        function renderGraph(field: UserPropertyField, row: TableRow, extra: Partial<React.ComponentProps<typeof ValueSelectorMenu>> = {}) {
            renderWithContext(
                <ValueSelectorMenu
                    row={row}
                    disabled={false}
                    updateValues={updateValues}
                    options={field.attrs?.options ?? []}
                    field={field}
                    {...extra}
                />,
            );
        }

        function openAndFilter(text: string) {
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));
            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: text}});
            return input;
        }

        test('offers no create item for an omitted graph with the flag off', () => {
            renderGraph(graphField(), graphRow());
            openAndFilter('Skunkworks');

            expect(screen.queryByText(/Create "Skunkworks"/)).not.toBeInTheDocument();
        });

        test('shows the search placeholder, not the create placeholder, for an omitted graph', () => {
            renderGraph(graphField(), graphRow());
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            // By accessible name rather than the placeholder attribute: Input
            // moves the placeholder text into its legend once focused and drops
            // the attribute, but keeps it on aria-label either way.
            expect(screen.getByRole('textbox', {name: 'Search values...'})).toBeInTheDocument();
            expect(screen.queryByRole('textbox', {name: /create/i})).not.toBeInTheDocument();
        });

        test('does not create a value on Enter in the filter for an omitted graph', () => {
            renderGraph(graphField(), graphRow());
            const input = openAndFilter('Skunkworks');

            fireEvent.keyDown(input, {key: 'Enter'});

            expect(updateValues).not.toHaveBeenCalled();
        });

        test('shows the select placeholder on the closed button for an omitted graph', () => {
            renderGraph(graphField(), graphRow({values: []}));

            const button = screen.getByTestId('valueSelectorMenuButton');
            expect(button).toHaveTextContent('Select values...');
            expect(button).not.toHaveTextContent('Type to create value');
        });

        test('still offers no create item for a hydrated graph', () => {
            renderGraph(graphField([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]), graphRow());

            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));
            expect(screen.getByText('Air Program')).toBeInTheDocument();

            fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Skunkworks'}});
            expect(screen.queryByText(/Create "Skunkworks"/)).not.toBeInTheDocument();
        });

        test('still offers create for a non-graph attribute with no options', () => {
            // The guard rail: without this, forbidCreate could be passed
            // unconditionally and every test above would still pass.
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({operator: 'has any of', attribute_type: 'multiselect'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                />,
            );
            openAndFilter('Skunkworks');

            expect(screen.getByText(/Create "Skunkworks"/)).toBeInTheDocument();
        });

        test('drops the create placeholder when a live row switches to a graph attribute', () => {
            // The transition case. MultiValueSelector memoises its closed-button
            // contents, and forbidCreate is read from inside that memo, so the
            // suppression only holds if the memo recomputes when forbidCreate
            // flips. The row object -- and therefore row.values -- is
            // deliberately the same instance across both renders, so nothing in
            // the memo's original key changes and a missing dependency shows up
            // as a create affordance surviving on a graph attribute.
            const row = graphRow({values: []});
            const props = {
                row,
                disabled: false,
                updateValues,
                options: [] as PropertyFieldOption[],
            };

            const {rerender} = renderWithContext(<ValueSelectorMenu {...props}/>);
            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Type to create value');

            rerender(
                <ValueSelectorMenu
                    {...props}
                    field={graphField()}
                />,
            );

            const button = screen.getByTestId('valueSelectorMenuButton');
            expect(button).toHaveTextContent('Select values...');
            expect(button).not.toHaveTextContent('Type to create value');
        });

        test('offers no create item for a graph row in channel-target mode', () => {
            const programs = channelField('channelPrograms', 'graph', 'Channel programs');

            renderGraph(
                graphField(),
                graphRow({targetAttribute: 'channelPrograms'}),
                {channelFields: [programs], onSelectTarget},
            );

            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Channel programs');

            openAndFilter('Skunkworks');
            expect(screen.queryByText(/Create "Skunkworks"/)).not.toBeInTheDocument();
        });
    });
});
