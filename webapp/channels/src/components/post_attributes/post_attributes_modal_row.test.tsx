// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';
import path from 'path';

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostAttributesModalRow from './post_attributes_modal_row';

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';
const POST_ID = 'post_id';

const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET', color: 'red'},
    {id: 'opt_unclassified', name: 'UNCLASSIFIED', color: 'green'},
];

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: GROUP_ID,
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: CHANNEL_ID,
        attrs: {options: OPTIONS, display_name: 'Classification'},
        permission_values: 'member',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value_1',
        target_id: POST_ID,
        target_type: 'post',
        group_id: GROUP_ID,
        field_id: 'field_1',
        value: 'opt_secret',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function renderRow(props: Partial<React.ComponentProps<typeof PostAttributesModalRow>> = {}) {
    const onChange = props.onChange ?? jest.fn();

    renderWithContext(
        <PostAttributesModalRow
            field={props.field ?? makeField()}
            value={'value' in props ? props.value : makeValue()}
            canEdit={props.canEdit ?? true}
            writing={props.writing ?? false}
            onChange={onChange}
        />,
    );

    return onChange;
}

describe('PostAttributesModalRow', () => {
    test('a writable set row renders a trigger and a trash button', () => {
        renderRow();

        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-clear-classification')).toBeInTheDocument();
    });

    test('a writable unset row renders a trigger and no trash button', () => {
        renderRow({value: undefined});

        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-clear-classification')).not.toBeInTheDocument();
    });

    test('a locked row renders the padlock, no trigger and no trash button', () => {
        renderRow({canEdit: false});

        expect(screen.queryByTestId('post-attribute-trigger-classification')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-clear-classification')).not.toBeInTheDocument();

        expect(screen.getByRole('img', {name: 'This is a system-level property and cannot be modified.'})).toBeInTheDocument();

        // The value is still readable.
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('the trash button is named after the attribute', () => {
        renderRow();

        expect(screen.getByRole('button', {name: 'Clear Classification'})).toBeInTheDocument();
    });

    test('the trash button clears by writing an empty value', async () => {
        const onChange = renderRow();

        await userEvent.click(screen.getByTestId('post-attribute-clear-classification'));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('field_1', '');
    });

    test('the trailing slot is the same width with and without the trash button', () => {
        const {unmount} = renderWithContext(
            <PostAttributesModalRow
                field={makeField()}
                value={makeValue()}
                canEdit={true}
                writing={false}
                onChange={jest.fn()}
            />,
        );

        const withButton = screen.getByTestId('post-attribute-row-classification').lastElementChild;
        expect(withButton).toHaveClass('PostAttributesModalRow__trailing');
        expect(withButton?.querySelector('button')).toBeInTheDocument();

        unmount();

        renderWithContext(
            <PostAttributesModalRow
                field={makeField()}
                value={undefined}
                canEdit={true}
                writing={false}
                onChange={jest.fn()}
            />,
        );

        const withoutButton = screen.getByTestId('post-attribute-row-classification').lastElementChild;

        // The slot itself is present and carries the same class in both cases, so
        // the fixed-width grid column reserves it either way. Revealing the
        // button on hover therefore cannot reflow the row.
        expect(withoutButton).toHaveClass('PostAttributesModalRow__trailing');
        expect(withoutButton?.querySelector('button')).not.toBeInTheDocument();
    });

    test('a writing row disables both the trigger and the trash button', () => {
        renderRow({writing: true});

        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeDisabled();
        expect(screen.getByTestId('post-attribute-clear-classification')).toBeDisabled();
    });

    test('a text field commits on blur, not on every keystroke', async () => {
        const field = makeField({id: 'field_text', name: 'reason', type: 'text', attrs: {display_name: 'Reason'}});
        const onChange = renderRow({
            field,
            value: makeValue({field_id: 'field_text', value: 'before'}),
        });

        const input = screen.getByTestId('post-attribute-input-reason');

        await userEvent.clear(input);
        await userEvent.type(input, 'after');

        expect(onChange).not.toHaveBeenCalled();

        await userEvent.tab();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('field_text', 'after');
    });

    test('a user field renders its value read-only and no trash button, pending part 2', () => {
        const field = makeField({id: 'field_user', name: 'reviewer', type: 'user', attrs: {display_name: 'Reviewer'}});

        renderRow({
            field,
            value: makeValue({field_id: 'field_user', value: 'user_1'}),
        });

        expect(screen.queryByTestId('post-attribute-trigger-reviewer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-clear-reviewer')).not.toBeInTheDocument();
    });
});
