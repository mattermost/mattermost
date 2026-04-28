// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

jest.mock('components/admin_console/content_flagging/user_multiselector/user_multiselector', () => ({
    UserSelector: ({singleSelectOnChange, singleSelectInitialValue, id}: {
        singleSelectOnChange: (id: string) => void;
        singleSelectInitialValue: string;
        id: string;
    }) => (
        <div data-testid={id}>
            <span data-testid='initial-value'>{singleSelectInitialValue}</span>
            <button
                type='button'
                onClick={() => singleSelectOnChange('user-42')}
            >{'Select user'}</button>
        </div>
    ),
}));

import UserEditor from './user_editor';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Assignee',
        type: 'user',
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

describe('components/property_value_editor/UserEditor', () => {
    test('renders the user selector for the field', () => {
        render(wrap(
            <UserEditor
                field={makeField()}
                value={undefined}
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByTestId('user-editor-f1')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Select user'})).toBeInTheDocument();
    });

    test('passes the current user id as the initial value', () => {
        render(wrap(
            <UserEditor
                field={makeField()}
                value='user-99'
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByTestId('initial-value')).toHaveTextContent('user-99');
    });

    test('passes empty string when value is undefined', () => {
        render(wrap(
            <UserEditor
                field={makeField()}
                value={undefined}
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByTestId('initial-value')).toHaveTextContent('');
    });

    test('calls onChange with the user id when a user is selected', () => {
        const onChange = jest.fn();
        render(wrap(
            <UserEditor
                field={makeField()}
                value={undefined}
                onChange={onChange}
            />,
        ));

        screen.getByText('Select user').click();
        expect(onChange).toHaveBeenCalledWith('user-42');
    });
});
