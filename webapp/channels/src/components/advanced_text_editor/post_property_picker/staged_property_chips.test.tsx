// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import StagedPropertyChips from './staged_property_chips';
import type {StagedPropertyItem} from './types';

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

describe('components/advanced_text_editor/post_property_picker/StagedPropertyChips', () => {
    test('renders nothing when no items are staged', () => {
        const {container} = render(
            <StagedPropertyChips
                fields={[]}
                stagedItems={[]}
                onRemove={jest.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('renders one chip per staged field showing the field name', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        const items: StagedPropertyItem[] = [
            {field_id: 'f1', value: undefined},
            {field_id: 'f2', value: undefined},
        ];

        render(
            <StagedPropertyChips
                fields={[status, priority]}
                stagedItems={items}
                onRemove={jest.fn()}
            />,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    test('skips staged items whose field cannot be resolved', () => {
        const items: StagedPropertyItem[] = [
            {field_id: 'missing', value: undefined},
        ];

        const {container} = render(
            <StagedPropertyChips
                fields={[]}
                stagedItems={items}
                onRemove={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('invokes onRemove when the remove button is clicked', () => {
        const onRemove = jest.fn();
        const items: StagedPropertyItem[] = [{field_id: 'f1', value: undefined}];

        render(
            <StagedPropertyChips
                fields={[makeField({id: 'f1', name: 'Status'})]}
                stagedItems={items}
                onRemove={onRemove}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /remove status/i}));
        expect(onRemove).toHaveBeenCalledWith('f1');
    });
});
