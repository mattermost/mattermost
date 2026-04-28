// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import DateEditor from './date_editor';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Due',
        type: 'date',
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

describe('components/property_value_editor/DateEditor', () => {
    test('renders an empty date input when value is missing', () => {
        render(
            <DateEditor
                field={makeField()}
                value={undefined}
                onChange={jest.fn()}
            />,
        );
        const input = screen.getByLabelText('Due') as HTMLInputElement;
        expect(input.type).toBe('date');
        expect(input.value).toBe('');
    });

    test('prefills the input with the existing ISO date', () => {
        render(
            <DateEditor
                field={makeField()}
                value='2026-04-01'
                onChange={jest.fn()}
            />,
        );
        expect((screen.getByLabelText('Due') as HTMLInputElement).value).toBe('2026-04-01');
    });

    test('emits the new ISO date when changed', () => {
        const onChange = jest.fn();
        render(
            <DateEditor
                field={makeField()}
                value=''
                onChange={onChange}
            />,
        );
        fireEvent.change(screen.getByLabelText('Due'), {target: {value: '2026-05-15'}});
        expect(onChange).toHaveBeenCalledWith('2026-05-15');
    });

    test('emits undefined when the date is cleared', () => {
        const onChange = jest.fn();
        render(
            <DateEditor
                field={makeField()}
                value='2026-04-01'
                onChange={onChange}
            />,
        );
        fireEvent.change(screen.getByLabelText('Due'), {target: {value: ''}});
        expect(onChange).toHaveBeenCalledWith(undefined);
    });
});
