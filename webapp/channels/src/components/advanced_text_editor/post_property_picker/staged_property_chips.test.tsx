// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import StagedPropertyChips from './staged_property_chips';
import type {StagedPropertyItem} from './types';

const render = renderWithContext;

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

    test('renders the shared "Empty" placeholder when value is unset', () => {
        const items: StagedPropertyItem[] = [{field_id: 'f1', value: undefined}];

        render(
            <StagedPropertyChips
                fields={[makeField({id: 'f1', name: 'Assignee', type: 'text'})]}
                stagedItems={items}
                onRemove={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        // The unset placeholder is the shared "Empty" copy used elsewhere in the UI.
        expect(screen.getByText('Empty')).toBeInTheDocument();

        // Old "Set <field>" copy is gone.
        expect(screen.queryByText(/set assignee/i)).not.toBeInTheDocument();

        // Italic-muted styling marker so the empty value is visually de-emphasized.
        const emptyEl = screen.getByText('Empty');
        expect(emptyEl).toHaveClass('staged-property-chip__empty');
    });

    test('renders each chip via the shared Tag widget', () => {
        const items: StagedPropertyItem[] = [{field_id: 'f1', value: undefined}];

        const {container} = render(
            <StagedPropertyChips
                fields={[makeField({id: 'f1', name: 'Status', type: 'text'})]}
                stagedItems={items}
                onRemove={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        // Chip is a Tag (sm size) carrying the field id on its DOM node.
        const tag = container.querySelector('[data-property-field-id="f1"]');
        expect(tag).not.toBeNull();
        expect(tag).toHaveClass('Tag', 'Tag--sm');
    });

    test('clicking the chip body opens the editor in a popover', () => {
        const items: StagedPropertyItem[] = [{field_id: 'f1', value: ''}];

        render(
            <StagedPropertyChips
                fields={[makeField({id: 'f1', name: 'Notes', type: 'text'})]}
                stagedItems={items}
                onRemove={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        // Editor isn't mounted before opening
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /edit notes/i}));
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('clicking the remove button does not open the popover', () => {
        const items: StagedPropertyItem[] = [{field_id: 'f1', value: ''}];

        render(
            <StagedPropertyChips
                fields={[makeField({id: 'f1', name: 'Notes', type: 'text'})]}
                stagedItems={items}
                onRemove={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /remove notes/i}));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    test('renders a value summary inside the trigger when set (select)', () => {
        const items: StagedPropertyItem[] = [{field_id: 'f1', value: 'opt1'}];

        const field: PropertyField = makeField({
            id: 'f1',
            name: 'Status',
            type: 'select',
            attrs: {
                options: [
                    {id: 'opt1', name: 'Open', color: '#ff00aa'},
                ],
            },
        });

        render(
            <StagedPropertyChips
                fields={[field]}
                stagedItems={items}
                onRemove={jest.fn()}
                onChangeValue={jest.fn()}
            />,
        );

        expect(screen.getByText('Open')).toBeInTheDocument();
        expect(screen.queryByText(/set status/i)).not.toBeInTheDocument();
    });
});
