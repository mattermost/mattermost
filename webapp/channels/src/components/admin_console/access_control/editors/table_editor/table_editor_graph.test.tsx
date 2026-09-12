// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import {CHANNEL_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import TableEditor from './table_editor';

jest.mock('mattermost-redux/actions/access_control', () => ({
    searchUsersForExpression: jest.fn(),
}));

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
