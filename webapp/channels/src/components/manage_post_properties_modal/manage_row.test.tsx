// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ManageRow from './manage_row';

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

function makeSelectField(options: PropertyFieldOption[]): PropertyField {
    return makeField({
        id: 'fs',
        name: 'Priority',
        type: 'select',
        attrs: {options} as PropertyField['attrs'],
    });
}

describe('components/manage_post_properties_modal/ManageRow', () => {
    test('renders read mode with name and type label, no inputs', () => {
        const field = makeField({name: 'Status', type: 'text'});

        renderWithContext(
            <ManageRow
                field={field}
                onEditRequest={jest.fn()}
                onDeleteRequest={jest.fn()}
            />,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText(/^Text$/)).toBeInTheDocument();
    });

    test('renders option chips in read mode for select fields', () => {
        const field = makeSelectField([
            {id: 'o1', name: 'Low', color: '#abcdef'},
            {id: 'o2', name: 'High', color: '#fedcba'},
        ]);

        renderWithContext(
            <ManageRow
                field={field}
                onEditRequest={jest.fn()}
                onDeleteRequest={jest.fn()}
            />,
        );

        expect(screen.getByText('Low')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
    });

    test('exposes the edit and delete buttons with accessible names', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onEditRequest={jest.fn()}
                onDeleteRequest={jest.fn()}
            />,
        );

        expect(screen.getByRole('button', {name: /edit f1/i})).toBeEnabled();
        expect(screen.getByRole('button', {name: /delete f1/i})).toBeEnabled();
    });

    test('clicking edit invokes onEditRequest with the field', () => {
        const onEditRequest = jest.fn();
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onEditRequest={onEditRequest}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        expect(onEditRequest).toHaveBeenCalledWith(field);
    });

    test('clicking the delete button invokes onDeleteRequest with the field id', () => {
        const onDeleteRequest = jest.fn();
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onEditRequest={jest.fn()}
                onDeleteRequest={onDeleteRequest}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /delete f1/i}));
        expect(onDeleteRequest).toHaveBeenCalledWith('f1');
    });
});
