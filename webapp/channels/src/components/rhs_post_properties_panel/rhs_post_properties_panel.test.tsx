// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import RhsPostPropertiesPanel from './rhs_post_properties_panel';

function openPickerAndSelectField(fieldId: string) {
    fireEvent.click(screen.getByRole('button', {name: /add property/i}));
    const item = document.getElementById(`post-property-picker-item-${fieldId}`);
    expect(item).toBeTruthy();
    fireEvent.click(item!);
}

async function waitForFieldRow(fieldId: string) {
    await waitFor(() => {
        expect(document.querySelector(`[data-property-field-id="${fieldId}"]`)).toBeInTheDocument();
    });
}

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

    test('renders an "Empty" placeholder for locally attached fields without a value', async () => {
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

        openPickerAndSelectField('f2');
        await waitForFieldRow('f2');

        const empty = screen.getByText(/^empty$/i);
        expect(empty).toBeInTheDocument();
        expect(empty).toHaveClass('rhs-post-properties-panel__empty');
    });

    test('does not render a show-all toggle', () => {
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

    test('renders add property inside the property rows list', () => {
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

        expect(container.querySelector('.rhs-post-properties-panel__add-row')).not.toBeNull();
        expect(container.querySelector('.rhs-post-properties-panel__add-property')).not.toBeNull();
        expect(screen.queryByRole('button', {name: /show all/i})).not.toBeInTheDocument();
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

    test('does not render a clear button on an empty row', async () => {
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

        openPickerAndSelectField('f2');
        await waitForFieldRow('f2');

        expect(screen.queryByRole('button', {name: /clear priority/i})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /clear status/i})).toBeInTheDocument();
    });

    test('selecting a field from the picker attaches it locally so it appears in the panel', async () => {
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

        expect(document.querySelector('[data-property-field-id="f2"]')).not.toBeInTheDocument();

        openPickerAndSelectField('f2');
        await waitForFieldRow('f2');

        expect(screen.getByRole('button', {name: /edit priority/i})).toBeInTheDocument();
    });

    test('empty select fields render an inline dropdown instead of an Empty trigger', async () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({
            id: 'f2',
            name: 'Priority',
            type: 'select',
            attrs: {
                options: [
                    {id: 'o1', name: 'Low'},
                    {id: 'o2', name: 'High'},
                ],
            } as PropertyField['attrs'],
        });

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

        openPickerAndSelectField('f2');
        await waitForFieldRow('f2');

        const row = document.querySelector('[data-property-field-id="f2"]');
        expect(row?.querySelector('.rhs-post-properties-panel__inline-editor')).toBeInTheDocument();
        expect(row?.querySelector('.rhs-post-properties-panel__empty')).not.toBeInTheDocument();
    });
});
