// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PropertyValueEditor from './index';

function wrap(ui: React.ReactElement) {
    return ui;
}

const usersState = {
    entities: {
        users: {
            currentUserId: 'me',
            profiles: {me: {id: 'me', username: 'me', first_name: 'Me', last_name: '', roles: ''}},
            profilesInChannel: {'channel-1': new Set(['me'])},
        },
        general: {config: {TeammateNameDisplay: 'full_name'}},
        preferences: {myPreferences: {}},
        teams: {currentTeamId: 't1', teams: {t1: {id: 't1'}}},
    },
};

function render(ui: React.ReactElement) {
    return renderWithContext(ui, usersState, {useMockedStore: true});
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

        // The date editor renders a react-day-picker calendar grid.
        expect(screen.getByRole('grid')).toBeInTheDocument();
        expect(screen.getByLabelText('Due')).toHaveAttribute('data-property-field-id', 'f1');
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
        // The user editor mounts the picker, identified by the field id on the wrapper.
        const wrapper = document.querySelector('[data-property-field-id="f1"]');
        expect(wrapper).not.toBeNull();
        expect(wrapper).toHaveClass('property-value-editor--user');
    });

    test('routes multiuser fields to the multi-mode user editor', () => {
        render(wrap(
            <PropertyValueEditor
                field={makeField({type: 'multiuser', name: 'Reviewers'})}
                value={[]}
                onChange={jest.fn()}
            />,
        ));
        const wrapper = document.querySelector('[data-property-field-id="f1"]');
        expect(wrapper).not.toBeNull();
        expect(wrapper).toHaveClass('property-value-editor--user');
    });
});
