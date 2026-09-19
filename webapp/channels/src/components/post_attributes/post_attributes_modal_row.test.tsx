// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

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

const alice = TestHelper.getUserMock({id: 'user_alice', username: 'alice'});
const bob = TestHelper.getUserMock({id: 'user_bob', username: 'bob'});

// `UserSelector` reads profiles, the license and the team list, so the user
// controls need a store even though the row itself does not.
const baseState: DeepPartial<GlobalState> = {
    entities: {
        general: {config: {}, license: {}},
        preferences: {myPreferences: {}},
        teams: {teams: {}},
        users: {
            profiles: {
                [alice.id]: alice,
                [bob.id]: bob,
            },
        },
    },
};

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
        baseState,
    );

    return onChange;
}

function userField(overrides: Partial<PropertyField> = {}): PropertyField {
    return makeField({
        id: 'field_user',
        name: 'reviewer',
        type: 'user',
        attrs: {display_name: 'Reviewer'},
        ...overrides,
    });
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

    /*
     * The `user` and `multiuser` controls. Rendered for real rather than
     * mocked: these assert that the row wires the stored value
     * into `UserSelector` and that `disabled` reaches it, which is exactly what
     * the modal suite's stub cannot say.
     */
    describe('the user controls', () => {
        test('a writable user row renders a picker showing the stored user, and a trash button', () => {
            renderRow({
                field: userField(),
                value: makeValue({field_id: 'field_user', value: alice.id}),
            });

            expect(screen.getByTestId('post-attribute-user-reviewer')).toBeInTheDocument();
            expect(screen.getByRole('combobox')).toBeInTheDocument();
            expect(screen.getByTestId('post-attribute-user-reviewer')).toHaveTextContent('alice');
            expect(screen.getByTestId('post-attribute-clear-reviewer')).toBeInTheDocument();
        });

        test('a writable multiuser row renders every stored user', () => {
            renderRow({
                field: userField({id: 'field_multiuser', name: 'reviewers', type: 'multiuser', attrs: {display_name: 'Reviewers'}}),
                value: makeValue({field_id: 'field_multiuser', value: [alice.id, bob.id]}),
            });

            const control = screen.getByTestId('post-attribute-user-reviewers');
            expect(control).toHaveTextContent('alice');
            expect(control).toHaveTextContent('bob');
        });

        test('an unset user row renders the picker with its placeholder and no trash button', () => {
            renderRow({field: userField(), value: undefined});

            expect(screen.getByTestId('post-attribute-user-reviewer')).toBeInTheDocument();
            expect(screen.getByText('Unassigned')).toBeInTheDocument();
            expect(screen.queryByTestId('post-attribute-clear-reviewer')).not.toBeInTheDocument();
        });

        test.each([
            ['user', 'reviewer', alice.id],
            ['multiuser', 'reviewers', [alice.id, bob.id]],
        ])('a writing %s row disables the picker and the trash button', (type, name, stored) => {
            renderRow({
                field: userField({id: `field_${type}`, name, type: type as FieldType, attrs: {display_name: name}}),
                value: makeValue({field_id: `field_${type}`, value: stored}),
                writing: true,
            });

            const picker = screen.getByTestId(`post-attribute-user-${name}`);
            expect(picker.querySelector('input')).toBeDisabled();
            expect(picker.querySelector('.UserMultiSelector__control--is-disabled')).toBeInTheDocument();
            expect(screen.getByTestId(`post-attribute-clear-${name}`)).toBeDisabled();
        });

        /*
         * Absence, not `disabled`. A locked row has no write to make,
         * so the picker and the trash button are omitted outright rather than
         * drawn as controls the user has to learn to ignore. The value is still
         * readable as text.
         */
        test.each([
            ['user', 'reviewer', alice.id, 'alice'],
            ['multiuser', 'reviewers', [alice.id, bob.id], 'alice and bob'],
        ])('a locked %s row renders the padlock, read-only text, no picker and no trash button', (type, name, stored, text) => {
            renderRow({
                field: userField({id: `field_${type}`, name, type: type as FieldType, attrs: {display_name: name}}),
                value: makeValue({field_id: `field_${type}`, value: stored}),
                canEdit: false,
            });

            expect(screen.queryByTestId(`post-attribute-user-${name}`)).not.toBeInTheDocument();
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            expect(screen.queryByTestId(`post-attribute-clear-${name}`)).not.toBeInTheDocument();

            expect(screen.getByRole('img', {name: 'This is a system-level property and cannot be modified.'})).toBeInTheDocument();
            expect(screen.getByTestId(`post-attribute-row-${name}`)).toHaveTextContent(text as string);
        });
    });
});
