// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import UserEditor from './user_editor';

const mockStoreOpts = {useMockedStore: true};

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

function baseState(extra: Partial<Record<string, unknown>> = {}) {
    return {
        entities: {
            users: {
                currentUserId: 'me',
                profiles: {
                    me: {id: 'me', username: 'leanord.ruley', first_name: 'Leanord', last_name: 'Riley', roles: ''},
                    u2: {id: 'u2', username: 'marshal.palmer', first_name: 'Marshall', last_name: 'Palmer', roles: ''},
                    u3: {id: 'u3', username: 'lee.reynolds', first_name: 'Lee', last_name: 'Reynolds', roles: ''},
                },
                profilesInChannel: {
                    'channel-1': new Set(['me', 'u2', 'u3']),
                },
            },
            general: {
                config: {TeammateNameDisplay: 'full_name'},
            },
            preferences: {
                myPreferences: {},
            },
            teams: {
                currentTeamId: 't1',
                teams: {t1: {id: 't1'}},
            },
        },
        ...extra,
    };
}

describe('components/property_value_editor/UserEditor', () => {
    test('renders the picker scoped to the field channel', () => {
        renderWithContext(
            <UserEditor
                field={makeField()}
                value={undefined}
                onChange={jest.fn()}
            />,
            baseState(),
            mockStoreOpts,
        );

        // The single-mode picker shows the search input and channel members header.
        expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
        expect(screen.getByText('Channel Members')).toBeInTheDocument();

        // It lists members of the channel, with the current user flagged as (you).
        expect(screen.getByText('Leanord Riley')).toBeInTheDocument();
        expect(screen.getByText('(you)')).toBeInTheDocument();
        expect(screen.getByText('Marshall Palmer')).toBeInTheDocument();
    });

    function clickRowInList(name: string) {
        // The same display name can also appear in the selected-chips row in multi mode,
        // so scope the click to the list element specifically.
        const row = screen.getByRole('option', {name: new RegExp(name)});
        const button = row.querySelector('button');
        if (!button) {
            throw new Error(`No button inside list row for ${name}`);
        }
        button.click();
    }

    test('selecting a user calls onChange with the user id (single)', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UserEditor
                field={makeField()}
                value={undefined}
                onChange={onChange}
            />,
            baseState(),
            mockStoreOpts,
        );

        clickRowInList('Lee Reynolds');
        expect(onChange).toHaveBeenCalledWith('u3');
    });

    test('multi mode toggles the user id in an array', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UserEditor
                field={makeField({type: 'multiuser'})}
                multi={true}
                value={['u2']}
                onChange={onChange}
            />,
            baseState(),
            mockStoreOpts,
        );

        clickRowInList('Lee Reynolds');
        expect(onChange).toHaveBeenCalledWith(['u2', 'u3']);
    });

    test('multi mode removes a user id when toggled off', () => {
        const onChange = jest.fn();
        renderWithContext(
            <UserEditor
                field={makeField({type: 'multiuser'})}
                multi={true}
                value={['u2', 'u3']}
                onChange={onChange}
            />,
            baseState(),
            mockStoreOpts,
        );

        clickRowInList('Lee Reynolds');
        expect(onChange).toHaveBeenCalledWith(['u2']);
    });
});
