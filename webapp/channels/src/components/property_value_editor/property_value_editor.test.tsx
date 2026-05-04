// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

jest.mock('components/admin_console/content_flagging/user_multiselector/user_multiselector', () => ({
    UserSelector: ({id}: {id: string}) => <div data-testid={id}/>,
}));

import PropertyValueEditor from './index';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

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

describe('components/property_value_editor/PropertyValueEditor', () => {
    test('routes text fields to the text editor', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({type: 'text', name: 'Notes'})}
                value='hello'
                onChange={jest.fn()}
            />,
        ));
        expect((screen.getByRole('textbox') as HTMLInputElement).type).toBe('text');
    });

    test('routes date fields to the date editor', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({type: 'date', name: 'Due'})}
                value='2026-04-01'
                onChange={jest.fn()}
            />,
        ));
        expect((screen.getByLabelText('Due') as HTMLInputElement).type).toBe('date');
    });

    test('routes select fields to a single-select combobox', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({
                    type: 'select',
                    name: 'Status',
                    attrs: {options: [{id: 'o1', name: 'Open'}]},
                })}
                value=''
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('routes multiselect fields to a multi-select combobox', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({
                    type: 'multiselect',
                    name: 'Tags',
                    attrs: {options: [{id: 'o1', name: 'Bug'}]},
                })}
                value={[]}
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('routes user fields to the user editor', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({type: 'user', name: 'Assignee'})}
                value='user-1'
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByTestId('user-editor-f1')).toBeInTheDocument();
    });

    test('renders a placeholder for unsupported field types', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({type: 'multiuser', name: 'Reviewers'})}
                value=''
                onChange={jest.fn()}
            />,
        ));
        expect(screen.getByText(/not yet supported/i)).toBeInTheDocument();
    });
});
