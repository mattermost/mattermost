// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PostPropertyPicker from './post_property_picker';

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
});
