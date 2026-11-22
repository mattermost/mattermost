// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PostAttributesButton from './post_attributes_button';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: 'group_id',
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: 'channel_id',
        attrs: {},
        permission_values: 'member',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

describe('PostAttributesButton', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders a plus button labelled for the composer, and not disabled', () => {
        renderWithContext(
            <PostAttributesButton
                fields={[makeField()]}
                onSelect={jest.fn()}
            />,
        );

        const button = screen.getByRole('button', {name: 'Add attributes'});

        expect(button).toBeInTheDocument();
        expect(button.id).toMatch(/^postAttributesButton-/);
        expect(button).not.toHaveAttribute('aria-disabled');

        // The focused element is the menu button itself, so it carries the
        // menu state that a screen reader announces.
        expect(button).toHaveAttribute('data-testid', 'post-attributes-composer-add');
        expect(button).toHaveAttribute('aria-haspopup', 'true');
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('opens the picker and reports the field picked', async () => {
        const onSelect = jest.fn();

        renderWithContext(
            <PostAttributesButton
                fields={[makeField({id: 'f_a', name: 'alpha'}), makeField({id: 'f_b', name: 'beta'})]}
                onSelect={onSelect}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add attributes'}));

        expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([
            'post-attribute-add-alpha',
            'post-attribute-add-beta',
        ]);

        await userEvent.click(screen.getByTestId('post-attribute-add-beta'));

        await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
        expect(onSelect).toHaveBeenCalledWith('f_b');
    });

    test('renders nothing when there is no field to offer', () => {
        renderWithContext(
            <PostAttributesButton
                fields={[]}
                onSelect={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('two buttons do not share an id', () => {
        renderWithContext(
            <>
                <PostAttributesButton
                    fields={[makeField()]}
                    onSelect={jest.fn()}
                />
                <PostAttributesButton
                    fields={[makeField()]}
                    onSelect={jest.fn()}
                />
            </>,
        );

        const [first, second] = screen.getAllByTestId('post-attributes-composer-add');

        expect(first.id).not.toBe(second.id);
        expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'));
    });
});
