// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import RhsPostPropertiesPanel from './rhs_post_properties_panel';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Status',
        type: 'text',
        target_id: 'channel-1',
        target_type: 'channel',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'v1',
        target_id: 'post-1',
        target_type: 'post',
        group_id: 'g1',
        field_id: 'f1',
        value: 'open',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

describe('components/rhs_post_properties_panel/RhsPostPropertiesPanel', () => {
    test('renders nothing when no fields are configured for the channel', () => {
        const {container} = renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[]}
                valuesByFieldId={{}}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('dispatches loadPostPropertyValues on mount', () => {
        const load = jest.fn();
        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[makeField()]}
                valuesByFieldId={{}}
                loadPostPropertyValues={load}
                onChangeValue={jest.fn()}
            />,
        );

        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith('post-1');
    });

    test('does not render a "Task" heading', () => {
        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[makeField()]}
                valuesByFieldId={{}}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        expect(screen.queryByText('Task')).not.toBeInTheDocument();
    });

    test('collapsed view shows only fields with values', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    });

    test('"Show all" toggle reveals empty fields and switches to "Show less"', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        const toggle = screen.getByRole('button', {name: /show all/i});
        fireEvent.click(toggle);

        expect(screen.getByText('Priority')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /show less/i})).toBeInTheDocument();
    });

    test('renders an "Empty" placeholder for fields without a value when expanded', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /show all/i}));

        const empty = screen.getByText(/^empty$/i);
        expect(empty).toBeInTheDocument();
        expect(empty).toHaveClass('rhs-post-properties-panel__empty');
    });

    test('does not show "Show all" when every field has a value', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                    f2: makeValue({field_id: 'f2', value: 'high', id: 'v2'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        expect(screen.queryByRole('button', {name: /show all/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /show less/i})).not.toBeInTheDocument();
    });

    test('clicking a value cell opens the editor in a popover', () => {
        const status = makeField({id: 'f1', name: 'Status', type: 'text'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        // Editor isn't mounted before opening
        expect(screen.queryByDisplayValue('open')).not.toBeInTheDocument();

        const trigger = screen.getByRole('button', {name: /edit status/i});
        fireEvent.click(trigger);

        expect(screen.getByDisplayValue('open')).toBeInTheDocument();
    });

    test('editing a value calls onChangeValue with the field id and new value', () => {
        const status = makeField({id: 'f1', name: 'Status', type: 'text'});
        const onChangeValue = jest.fn();

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={onChangeValue}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit status/i}));
        const input = screen.getByDisplayValue('open');
        fireEvent.change(input, {target: {value: 'in progress'}});

        expect(onChangeValue).toHaveBeenCalledWith('f1', 'in progress');
    });

    test('renders the "Add property" picker trigger', () => {
        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[makeField()]}
                valuesByFieldId={{}}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        expect(screen.getByRole('button', {name: /add property/i})).toBeInTheDocument();
    });

    test('footer renders "Add property" and "Show all" together inside one row', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        const {container} = renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        const footer = container.querySelector('.rhs-post-properties-panel__footer');
        expect(footer).not.toBeNull();
        expect(footer?.querySelector('.rhs-post-properties-panel__add-property')).not.toBeNull();
        expect(footer?.querySelector('.rhs-post-properties-panel__toggle')).not.toBeNull();
    });

    test('picker only lists fields that are not already attached to the post', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});
        const dueDate = makeField({id: 'f3', name: 'Due date'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority, dueDate]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        // Only Priority and Due date should be in the picker menu.
        expect(screen.getByRole('menuitem', {name: /priority/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /due date/i})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: /^status$/i})).not.toBeInTheDocument();
    });

    test('clicking the row clear button calls onChangeValue with (fieldId, null)', () => {
        const status = makeField({id: 'f1', name: 'Status', type: 'text'});
        const onChangeValue = jest.fn();

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={onChangeValue}
            />,
        );

        const clear = screen.getByRole('button', {name: /clear status/i});
        fireEvent.click(clear);

        expect(onChangeValue).toHaveBeenCalledWith('f1', null);
    });

    test('clicking the row clear button does not open the editor popover', () => {
        const status = makeField({id: 'f1', name: 'Status', type: 'text'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        // Editor isn't mounted before
        expect(screen.queryByDisplayValue('open')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /clear status/i}));

        // Editor still not mounted after — clear should not open the popover
        expect(screen.queryByDisplayValue('open')).not.toBeInTheDocument();
    });

    test('row clear button is a focusable <button>', () => {
        const status = makeField({id: 'f1', name: 'Status', type: 'text'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        const clear = screen.getByRole('button', {name: /clear status/i});
        expect(clear.tagName).toBe('BUTTON');
        clear.focus();
        expect(clear).toHaveFocus();
    });

    test('does not render a clear button on an empty row in expanded view', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /show all/i}));

        // Priority is unfilled in expanded view — no clear button
        expect(screen.queryByRole('button', {name: /clear priority/i})).not.toBeInTheDocument();

        // Status is filled — clear button present
        expect(screen.getByRole('button', {name: /clear status/i})).toBeInTheDocument();
    });

    test('selecting a field from the picker attaches it locally so it appears in the panel', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <RhsPostPropertiesPanel
                postId='post-1'
                channelId='channel-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                }}
                loadPostPropertyValues={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        // Initially Priority is hidden in collapsed view.
        expect(screen.queryByText('Priority')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        fireEvent.click(screen.getByRole('menuitem', {name: /priority/i}));

        expect(screen.getByText('Priority')).toBeInTheDocument();
    });
});
