// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {CHANNEL_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';

import {pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

import TableEditor from './table_editor';

jest.mock('mattermost-redux/actions/access_control', () => ({
    searchUsersForExpression: jest.fn(),
}));

// The widget calls the pager directly, so mocking the helper rather than
// Client4 keeps Phase 1's dedupe/abort machinery out of these tests. spread
// requireActual so the module's other exports survive for anything that reads
// them.
jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),

    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

// File scope: a test that opens the tree without queuing a response would
// otherwise hit an unimplemented mock, which resolves to undefined and throws
// `.then` from inside a React effect. That reads as an unrelated render crash
// rather than "this test opened the menu and forgot to stub the pager".
// clearMocks resets call state but not implementations, so this is
// re-established every test.
beforeEach(() => {
    mockPageAll.mockReset();
    mockPageAll.mockImplementation(() => {
        throw new Error('pageAllAccessControlFieldOptions was called by a test that queued no response');
    });
});

// A graph attribute holds options drawn from a hierarchy. Both the user field
// and the channel field below link to the same template field, which is what
// makes their option identifiers comparable.
const graphTemplateId = 'programs-template-id';

const makeField = (overrides: Partial<UserPropertyField>): UserPropertyField => ({
    id: 'field-id',
    name: 'field',
    type: 'text',
    group_id: 'custom_profile_attributes',
    create_at: 1736541716295,
    update_at: 1736541716295,
    delete_at: 0,
    created_by: '',
    updated_by: '',
    target_id: '',
    target_type: '',
    object_type: 'user',
    attrs: {
        sort_order: 0,
        visibility: 'when_set',
        value_type: '',
    },
    ...overrides,
});

const userPrograms = makeField({
    id: 'user-programs',
    name: 'programs',
    type: 'graph',
    linked_field_id: graphTemplateId,
    attrs: {
        sort_order: 0,
        visibility: 'when_set',
        value_type: '',
        options: [
            {id: 'opt-air', name: 'Air Program'},
            {id: 'opt-f18', name: 'F-18 Program'},
        ],
    },
});

const channelPrograms = makeField({
    id: 'channel-programs',
    name: 'channelPrograms',
    type: 'graph',
    object_type: CHANNEL_ATTRIBUTES_OBJECT_TYPE,
    linked_field_id: graphTemplateId,
    attrs: {
        sort_order: 0,
        visibility: 'when_set',
        value_type: '',
        options: [
            {id: 'opt-air', name: 'Air Program'},
            {id: 'opt-f18', name: 'F-18 Program'},
        ],
    },
});

const userDepartment = makeField({
    id: 'user-department',
    name: 'department',
    type: 'text',
});

describe('TableEditor - graph attributes', () => {
    const actions = {getVisualAST: jest.fn()};
    const onChange = jest.fn();

    const baseProps = {
        value: '',
        onChange,
        userAttributes: [userPrograms, channelPrograms, userDepartment],
        enableUserManagedAttributes: true,
        onParseError: jest.fn(),
        actions,
    };

    beforeEach(() => {
        actions.getVisualAST.mockClear();
        onChange.mockClear();
        mockPageAll.mockResolvedValue([
            {id: 'opt-air', name: 'Air Program'},
            {id: 'opt-f18', name: 'F-18 Program'},
        ]);
    });

    test('a new row on a graph attribute defaults to "covers all of"', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...baseProps}/>, {});

        await userEvent.click(await screen.findByRole('button', {name: /add attribute/i}));

        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });
        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('covers all of');
    });

    test('picking option names on a hierarchy predicate emits the member-call form', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...baseProps}/>, {});

        await userEvent.click(await screen.findByRole('button', {name: /add attribute/i}));
        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'}));

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(["F-18 Program"])');
    });

    test('a saved hierarchy predicate renders as a row and re-emits unchanged', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'withinAny',
                        value: ['Air Program'],
                        value_type: 0,
                        attribute_type: 'graph',
                    },
                ],
            },
        });

        renderWithContext(
            <TableEditor
                {...baseProps}
                value='user.attributes.programs.withinAny(["Air Program"])'
            />,
            {},
        );

        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });
        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('is within any of');
        expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Air Program');
    });

    test('a graph channel attribute is offered as the target of a hierarchy predicate', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...baseProps}/>, {});

        await userEvent.click(await screen.findByRole('button', {name: /add attribute/i}));
        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /channelPrograms/}));

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(resource.attributes.channelPrograms)');
    });

    test('switching to a membership operator drops the channel target and lowers to an in-chain', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'coversAll',
                        value: 'resource.attributes.channelPrograms',
                        value_type: 1,
                        attribute_type: 'graph',
                    },
                ],
            },
        });

        renderWithContext(
            <TableEditor
                {...baseProps}
                value='user.attributes.programs.coversAll(resource.attributes.channelPrograms)'
            />,
            {},
        );

        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: 'has all of'}));

        // The target is gone and the row has no literal values yet, so it can
        // form no condition at all — the editor emits an empty expression rather
        // than a membership test against a channel attribute, which is a shape
        // the server refuses on a graph field.
        expect(onChange).toHaveBeenLastCalledWith('');

        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'}));

        expect(onChange).toHaveBeenLastCalledWith('"F-18 Program" in user.attributes.programs');
    });

    test('changing the attribute resets an operator the new type cannot use', async () => {
        // A hierarchy predicate is meaningless on a text attribute, and a text
        // comparison is refused on a graph one, so switching either way has to
        // move the row to a default the new type accepts.
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...baseProps}/>, {});

        await userEvent.click(await screen.findByRole('button', {name: /add attribute/i}));
        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });
        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('covers all of');

        await userEvent.click(screen.getByTestId('attributeSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /department/}));
        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('is');

        await userEvent.click(screen.getByTestId('attributeSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /programs/}));
        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('covers all of');
    });

    test('a membership row the server reported as multiselect is still treated as graph', async () => {
        // The server cannot label an `in` chain on a graph field as graph, so the
        // row arrives saying multiselect. Everything that keys on the type has to
        // resolve the field instead, or picking a channel target under a
        // hierarchy predicate and then switching back to membership would leave
        // the target in place and emit hasAllOf against a graph attribute.
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'hasAllOf',
                        value: ['F-18 Program'],
                        value_type: 0,
                        attribute_type: 'multiselect',
                    },
                ],
            },
        });

        renderWithContext(
            <TableEditor
                {...baseProps}
                value='"F-18 Program" in user.attributes.programs'
            />,
            {},
        );

        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });

        // The graph operator set, not the multiselect one the row claims.
        await userEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: 'covers any of'}));

        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /channelPrograms/}));
        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAny(resource.attributes.channelPrograms)');

        await userEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: 'has all of'}));
        expect(onChange).toHaveBeenLastCalledWith('');
    });

    test('a membership operator on a graph attribute offers no channel target', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...baseProps}/>, {});

        await userEvent.click(await screen.findByRole('button', {name: /add attribute/i}));
        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });

        // Offered under the hierarchy predicate the row starts on...
        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        expect(await screen.findByRole('menuitemradio', {name: /channelPrograms/})).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');

        await userEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: 'has any of'}));

        // ...and withdrawn under exact membership, which compares against option
        // names only.
        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        expect(await screen.findByRole('menuitemcheckbox', {name: 'F-18 Program'})).toBeInTheDocument();
        expect(screen.queryByRole('menuitemradio', {name: /channelPrograms/})).not.toBeInTheDocument();
    });
});

const graphEnabledState = {
    entities: {
        general: {
            config: {
                FeatureFlagPropertyFieldGraph: 'true',
            },
        },
    },
};

// Air Program ─ Fighter Jet Program ─ F-18 Program, matching the shape of the
// Playwright fixture so Jest and e2e agree. `parents` holds option NAMES, which
// is what the server sends and what indexOptions resolves against.
const hierarchyOptions: PropertyFieldOption[] = [
    {id: 'opt-air', name: 'Air Program', parents: [], create_at: 1},
    {id: 'opt-jet', name: 'Fighter Jet Program', parents: ['Air Program'], create_at: 2},
    {id: 'opt-f18', name: 'F-18 Program', parents: ['Fighter Jet Program'], create_at: 3},
];

// Regimes A/B: 1..1000 options, so the payload inlines the complete list and a
// saved row can render checked before the menu is ever opened.
const programsHydrated = makeField({
    id: 'user-programs',
    name: 'programs',
    type: 'graph',
    linked_field_id: graphTemplateId,
    attrs: {
        sort_order: 0,
        visibility: 'when_set',
        value_type: '',
        options: hierarchyOptions,
    },
});

// Regime C: above PropertyFieldMaxHydratedOptions the payload carries no option
// list at all, only the markers.
const programsOmitted = makeField({
    id: 'user-programs',
    name: 'programs',
    type: 'graph',
    linked_field_id: graphTemplateId,
    attrs: {
        sort_order: 0,
        visibility: 'when_set',
        value_type: '',
        options_omitted: true,
        options_count: 1500,
    } as UserPropertyField['attrs'],
});

describe('TableEditor - graph attributes with the hierarchy picker', () => {
    const actions = {getVisualAST: jest.fn()};
    const onChange = jest.fn();

    const propsFor = (programs: UserPropertyField) => ({
        value: '',
        onChange,
        userAttributes: [programs, channelPrograms, userDepartment],
        enableUserManagedAttributes: true,
        onParseError: jest.fn(),
        actions,
    });

    beforeEach(() => {
        actions.getVisualAST.mockClear();
        onChange.mockClear();
    });

    const addRow = async () => {
        await userEvent.click(await screen.findByRole('button', {name: /add attribute/i}));
        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });
    };

    const openValues = async () => {
        await userEvent.click(screen.getByTestId('valueSelectorMenuButton'));
    };

    const treeRow = (name: string) => screen.findByRole('menuitemcheckbox', {name});

    // The checkbox is the leadingElement span carrying data-hit="select". It is
    // aria-hidden, so it is not reachable by role — locate the row, then the
    // checkbox inside it.
    const clickCheckbox = async (name: string) => {
        const row = await treeRow(name);
        await userEvent.click(row.querySelector('[data-hit="select"]')!);
    };

    // A click on the label span selects, matching the checkbox and keyboard.
    const clickBody = async (name: string) => {
        const row = await treeRow(name);
        await userEvent.click(within(row).getByText(name));
    };

    const clickChevron = async (name: string) => {
        const row = await treeRow(name);
        await userEvent.click(row.querySelector('.hierarchical-value-menu__chevron')!);
    };

    const searchFor = async (text: string) => {
        await userEvent.type(screen.getByRole('textbox', {name: 'Search values'}), text);
    };

    test('renders the hierarchy picker instead of the flat option list', async () => {
        // The field inlines all three options, so a broken gate falling back to
        // the flat picker would render all three at once. The tree renders only
        // the root until it is expanded.
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();
        await openValues();

        expect((await treeRow('Air Program')).id).toMatch(/^value-selector-menu-0-row-/);
        expect(screen.queryByRole('menuitemcheckbox', {name: 'Fighter Jet Program'})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitemcheckbox', {name: 'F-18 Program'})).not.toBeInTheDocument();
    });

    test('preserves the value selector test id on the closed control', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();

        // Presence alone would be tautological -- addRow() already waits on this
        // testid, so a missing one fails inside the helper. The load-bearing part
        // is whose button carries it: the tree suffixes the row index, the flat
        // control's is the bare 'value-selector-button'. So this asserts the e2e
        // handle survived onto the tree's trigger specifically.
        expect(screen.getByTestId('valueSelectorMenuButton').id).toBe('value-selector-button-0');
    });

    test('gives the open menu an id the policy e2e selector matches', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await treeRow('Air Program');

        // By role rather than by the '[id^="value-selector-menu"]' prefix the
        // Playwright specs use: that prefix now also matches every row, and a
        // querySelector would only pick the menu because it precedes its own
        // children. This asserts the id the e2e locator needs still exists; it
        // does not and cannot cover the strict-mode violation the extra matches
        // cause in Playwright, which is handed to Phase 6.
        expect(screen.getByRole('menu').id).toBe('value-selector-menu-0');
    });

    test('emits option names, not ids, when a value is checked', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();

        await clickChevron('Air Program');
        await clickChevron('Fighter Jet Program');
        await clickCheckbox('F-18 Program');

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(["F-18 Program"])');
    });

    test('selects a leaf when its row body is clicked', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();

        await clickChevron('Air Program');
        await clickChevron('Fighter Jet Program');
        await clickBody('F-18 Program');

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(["F-18 Program"])');
    });

    test('selects a branch when its row body is clicked', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await treeRow('Air Program');

        onChange.mockClear();
        await clickBody('Air Program');

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(["Air Program"])');
        expect(screen.queryByRole('menuitemcheckbox', {name: 'Fighter Jet Program'})).not.toBeInTheDocument();
    });

    test('expands a branch by its chevron without changing the selection', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await treeRow('Air Program');

        onChange.mockClear();
        await clickChevron('Air Program');

        expect(await treeRow('Fighter Jet Program')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    test('selects a branch when its checkbox is clicked', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await clickCheckbox('Air Program');

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(["Air Program"])');
        expect(screen.queryByRole('menuitemcheckbox', {name: 'Fighter Jet Program'})).not.toBeInTheDocument();
    });

    test('finds a deep value through search without expanding', async () => {
        // The Playwright fix rehearsed: a non-empty query flattens the tree to
        // label matches, so a value three levels down needs no expansion.
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await treeRow('Air Program');

        await searchFor('F-18');
        await clickBody('F-18 Program');

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(["F-18 Program"])');
    });

    test('omits the row when the last value is unchecked', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'coversAll',
                        value: ['F-18 Program'],
                        value_type: 0,
                        attribute_type: 'graph',
                    },
                ],
            },
        });
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(
            <TableEditor
                {...propsFor(programsHydrated)}
                value='user.attributes.programs.coversAll(["F-18 Program"])'
            />,
            graphEnabledState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });
        await openValues();

        // Its ancestors open on the way in, because a selected value has to be
        // visible when the menu is opened.
        await clickCheckbox('F-18 Program');

        expect(onChange).toHaveBeenLastCalledWith('');
    });

    test('renders a saved row checked from the inlined option payload without opening', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'withinAny',
                        value: ['Air Program'],
                        value_type: 0,
                        attribute_type: 'graph',
                    },
                ],
            },
        });

        renderWithContext(
            <TableEditor
                {...propsFor(programsHydrated)}
                value='user.attributes.programs.withinAny(["Air Program"])'
            />,
            graphEnabledState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });
        expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Air Program');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('checks a saved row from the fetched options when the payload omitted them', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'coversAll',
                        value: ['F-18 Program'],
                        value_type: 0,
                        attribute_type: 'graph',
                    },
                ],
            },
        });
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(
            <TableEditor
                {...propsFor(programsOmitted)}
                value='user.attributes.programs.coversAll(["F-18 Program"])'
            />,
            graphEnabledState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });
        await openValues();
        await treeRow('Air Program');
        await searchFor('F-18');

        // The name stood in as its own id until the walk landed; the adapter
        // re-hydrated it to opt-f18 off onOptionsLoaded.
        expect(await treeRow('F-18 Program')).toHaveAttribute('aria-checked', 'true');
    });

    test('keeps the CHANNEL ATTRIBUTES block below the tree', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();
        await openValues();

        const row = await treeRow('Air Program');
        const channelTarget = await screen.findByRole('menuitemradio', {name: /channelPrograms/});

        // Ordering, not just co-presence: the name says "below the tree", so
        // assert it. DOCUMENT_POSITION_FOLLOWING means channelTarget comes after
        // the tree row in document order.
        expect(row.compareDocumentPosition(channelTarget) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    test('switches to a channel target from inside the tree menu', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /channelPrograms/}));

        expect(onChange).toHaveBeenLastCalledWith('user.attributes.programs.coversAll(resource.attributes.channelPrograms)');
    });

    test('returns to the flat control once the row targets a channel attribute', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'coversAll',
                        value: 'resource.attributes.channelPrograms',
                        value_type: 1,
                        attribute_type: 'graph',
                    },
                ],
            },
        });

        renderWithContext(
            <TableEditor
                {...propsFor(programsHydrated)}
                value='user.attributes.programs.coversAll(resource.attributes.channelPrograms)'
            />,
            graphEnabledState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });
        expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent(/Channel:\s*channelPrograms/);

        await openValues();

        // The discriminators are behavioural and both sit above/below: only the
        // flat control can render the 'Channel: X' button label, and the tree
        // fetches on every open by design, so an unfetched menu cannot be the
        // tree. The row-id assertions below are structural corroboration -- both
        // controls label their rows with the option name, so the id is the only
        // way to name which one rendered -- not the thing that catches a broken
        // gate.
        expect(await screen.findByRole('menuitemcheckbox', {name: 'Air Program'})).toHaveAttribute('id', 'value-option-opt-air');
        expect(document.querySelector('[id^="value-selector-menu-0-row-"]')).toBeNull();
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('withdraws the channel target under a membership operator but keeps the tree', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();

        await userEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: 'has all of'}));

        await openValues();
        expect(await treeRow('Air Program')).toBeInTheDocument();
        expect(screen.queryByRole('menuitemradio', {name: /channelPrograms/})).not.toBeInTheDocument();
    });

    test('emits an in-chain under a membership operator', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();

        await userEvent.click(screen.getByTestId('operatorSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: 'has all of'}));

        await openValues();
        await treeRow('Air Program');
        await searchFor('F-18');
        await clickBody('F-18 Program');

        expect(onChange).toHaveBeenLastCalledWith('"F-18 Program" in user.attributes.programs');
    });

    test('offers no create item in the tree menu', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsOmitted)}/>, graphEnabledState);
        await addRow();
        await openValues();
        await treeRow('Air Program');

        await searchFor('Skunkworks');

        expect(screen.queryByText(/Create "Skunkworks"/)).not.toBeInTheDocument();

        // By the status row's id rather than its text: the copy belongs to
        // Phase 3 and Phase 6 owns i18n extraction, so asserting the string here
        // would couple this test to a message another phase is free to reword.
        // What matters is that the empty search resolves to a status row instead
        // of a create affordance.
        await waitFor(() => {
            expect(document.getElementById('value-selector-menu-0-status')).not.toBeNull();
        });
    });

    test('does not fetch for a non-graph attribute with the flag on', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();

        await userEvent.click(screen.getByTestId('attributeSelectorMenuButton'));
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /department/}));

        // A text attribute with no comparable channel field keeps its bare input.
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('mounts the hierarchy picker even when PropertyFieldGraph is off', async () => {
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});
        mockPageAll.mockResolvedValue(hierarchyOptions);

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, {});
        await addRow();
        await openValues();

        expect(await treeRow('Air Program')).toBeInTheDocument();
        expect(screen.queryByRole('menuitemcheckbox', {name: 'Fighter Jet Program'})).not.toBeInTheDocument();
        expect(mockPageAll).toHaveBeenCalled();
    });

    test('shows the masked chip on a masked graph row', async () => {
        actions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.programs',
                        operator: 'coversAll',
                        value: [],
                        value_type: 0,
                        attribute_type: 'graph',
                        has_masked_values: true,
                    },
                ],
            },
        });

        renderWithContext(
            <TableEditor
                {...propsFor(programsHydrated)}
                value='user.attributes.programs.coversAll([])'
            />,
            graphEnabledState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('valueSelectorMenuButton')).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Hidden values that you do not have permission to view')).toBeInTheDocument();
        expect(screen.getByTestId('valueSelectorMenuButton')).toBeDisabled();
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('shows the placeholder on an empty unmasked graph row', async () => {
        // Guards the conditional trailingChips: an unconditional MaskedChip
        // would suppress the widget's placeholder on every empty graph row.
        actions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...propsFor(programsHydrated)}/>, graphEnabledState);
        await addRow();

        expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Select values...');
        expect(screen.queryByLabelText('Hidden values that you do not have permission to view')).not.toBeInTheDocument();
    });
});
