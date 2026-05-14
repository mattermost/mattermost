// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import TextEditor from './text_editor';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Notes',
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

describe('components/property_value_editor/TextEditor', () => {
    test('renders an input prefilled with the current value', () => {
        render(
            <TextEditor
                field={makeField()}
                value='hello'
                onChange={jest.fn()}
            />,
        );
        expect(screen.getByRole('textbox')).toHaveValue('hello');
        expect(screen.getByLabelText('Notes')).toHaveValue('hello');
    });

    test('renders an empty input when value is undefined', () => {
        render(
            <TextEditor
                field={makeField()}
                value={undefined}
                onChange={jest.fn()}
            />,
        );
        expect(screen.getByLabelText('Notes')).toHaveValue('');
    });

    test('calls onChange when the user types', () => {
        const onChange = jest.fn();
        render(
            <TextEditor
                field={makeField()}
                value=''
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByLabelText('Notes'), {target: {value: 'updated'}});
        expect(onChange).toHaveBeenCalledWith('updated');
    });

    test('coerces non-string values to a string for display', () => {
        render(
            <TextEditor
                field={makeField()}
                value={42}
                onChange={jest.fn()}
            />,
        );
        expect(screen.getByLabelText('Notes')).toHaveValue('42');
    });
});
