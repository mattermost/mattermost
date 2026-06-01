// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {patchChannelPostPropertyField} from 'mattermost-redux/actions/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PostPropertyPicker from './post_property_picker';

jest.mock('mattermost-redux/actions/properties', () => ({
    ...jest.requireActual('mattermost-redux/actions/properties'),
    patchChannelPostPropertyField: jest.fn(() => ({type: 'MOCK_PATCH'})),
    deleteChannelPostPropertyField: jest.fn(() => ({type: 'MOCK_DELETE'})),
}));

const patchMock = patchChannelPostPropertyField as jest.MockedFunction<typeof patchChannelPostPropertyField>;

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

describe('components/advanced_text_editor/post_property_picker/PostPropertyPicker', () => {
    beforeEach(() => {
        patchMock.mockClear();
    });

    test('renders the picker trigger button', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        expect(screen.getByRole('button', {name: /add property/i})).toBeInTheDocument();
    });

    test('opens the menu and lists each existing field', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        renderWithContext(
            <PostPropertyPicker
                fields={[status, priority]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    test('clicking a field item invokes onToggleStaged with that field id', () => {
        const onToggle = jest.fn();
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField({id: 'f1', name: 'Status'})]}
                stagedFieldIds={[]}
                onToggleStaged={onToggle}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        fireEvent.click(screen.getByText('Status'));

        expect(onToggle).toHaveBeenCalledWith('f1');
    });

    test('marks already-staged fields as checked', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField({id: 'f1', name: 'Status'})]}
                stagedFieldIds={['f1']}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        const item = screen.getByRole('menuitemcheckbox', {name: /status/i});
        expect(item).toHaveAttribute('aria-checked', 'true');
    });

    test('shows an empty-state hint when no fields exist for the channel', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        expect(screen.getByText(/no properties yet/i)).toBeInTheDocument();
    });

    test('mode="rhs" renders items as plain menuitems without aria-checked', () => {
        renderWithContext(
            <PostPropertyPicker
                mode='rhs'
                fields={[makeField({id: 'f1', name: 'Status'})]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        expect(screen.getByRole('menuitem', {name: /status/i})).toBeInTheDocument();
        expect(screen.queryByRole('menuitemcheckbox')).not.toBeInTheDocument();
    });

    test('mode="rhs" trigger has accessible label "Add property"', () => {
        renderWithContext(
            <PostPropertyPicker
                mode='rhs'
                fields={[]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        const trigger = screen.getByRole('button', {name: /add property/i});
        expect(trigger).toBeInTheDocument();
    });

    test('renders a "Manage properties" item when onManageClick is provided', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField()]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                onManageClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        expect(screen.getByText(/manage properties/i)).toBeInTheDocument();
    });

    test('does not render "Manage properties" item when onManageClick is not provided', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField()]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        expect(screen.queryByText(/manage properties/i)).not.toBeInTheDocument();
    });

    test('renders a type icon next to each field row', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[
                    makeField({id: 'f1', name: 'Status', type: 'select'}),
                    makeField({id: 'f2', name: 'Due date', type: 'date'}),
                    makeField({id: 'f3', name: 'Owner', type: 'user'}),
                ]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        // Each row should expose its type icon via the wrapper class
        expect(document.querySelector('.property-type-icon--select')).not.toBeNull();
        expect(document.querySelector('.property-type-icon--date')).not.toBeNull();
        expect(document.querySelector('.property-type-icon--user')).not.toBeNull();
    });

    test('filters items case-insensitively by the search input', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[
                    makeField({id: 'f1', name: 'Status'}),
                    makeField({id: 'f2', name: 'Priority'}),
                    makeField({id: 'f3', name: 'Due date'}),
                ]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        const search = screen.getByPlaceholderText(/search properties/i) as HTMLInputElement;
        fireEvent.change(search, {target: {value: 'pri'}});

        expect(screen.queryByText('Status')).not.toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
        expect(screen.queryByText('Due date')).not.toBeInTheDocument();
    });

    test('staging mode renders the trigger as a labeled pill', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        const trigger = screen.getByRole('button', {name: /add property/i});
        expect(trigger).toHaveClass('post-property-picker__trigger');
        expect(trigger.textContent).toMatch(/add property/i);
    });

    test('add-new entry remains visible when fields are empty', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onAddNewClick={jest.fn()}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));

        expect(screen.getByText(/add new property/i)).toBeInTheDocument();
        expect(screen.getByText(/no properties yet/i)).toBeInTheDocument();
    });

    test('clicking "Add new property" swaps the menu body to the new-property form', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField({id: 'f1', name: 'Status'})]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onCreateField={jest.fn(() => Promise.resolve())}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        expect(screen.getByText('Status')).toBeInTheDocument();

        fireEvent.click(screen.getByText(/add new property/i));

        // Items list and search are hidden; the form is shown
        expect(screen.queryByText('Status')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/search properties/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Type')).toBeInTheDocument();
    });

    test('clicking Cancel inside the form returns to the items list', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField({id: 'f1', name: 'Status'})]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onCreateField={jest.fn(() => Promise.resolve())}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        fireEvent.click(screen.getByText(/add new property/i));
        expect(screen.getByLabelText('Name')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /cancel/i}));

        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('saving the form calls onCreateField with the entered name and type', async () => {
        const onCreateField = jest.fn(() => Promise.resolve());

        renderWithContext(
            <PostPropertyPicker
                fields={[]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onCreateField={onCreateField}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        fireEvent.click(screen.getByText(/add new property/i));

        fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Owner'}});

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: /save/i}));
        });

        expect(onCreateField).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Owner',
            type: 'text',
        }));
    });

    test('clicking edit opens the full property form pre-filled with the field', () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField({id: 'f1', name: 'Status', type: 'select', attrs: {options: [{id: 'o1', name: 'Open'}]}})]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onCreateField={jest.fn(() => Promise.resolve())}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        fireEvent.click(screen.getByRole('button', {name: /edit status/i}));

        expect(screen.queryByText('Status')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/search properties/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveValue('Status');
        expect(screen.getByLabelText('Type')).toBeInTheDocument();
        expect(screen.getByText('Open')).toBeInTheDocument();
    });

    test('saving the edit form patches the field and returns to the list', async () => {
        renderWithContext(
            <PostPropertyPicker
                fields={[makeField({id: 'f1', name: 'Status', type: 'text'})]}
                stagedFieldIds={[]}
                onToggleStaged={jest.fn()}
                onCreateField={jest.fn(() => Promise.resolve())}
                disabled={false}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /add property/i}));
        fireEvent.click(screen.getByRole('button', {name: /edit status/i}));

        fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'State'}});

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: /save/i}));
        });

        expect(patchMock).toHaveBeenCalledWith('f1', {name: 'State'});
        expect(screen.getByText('Status')).toBeInTheDocument();
    });
});
