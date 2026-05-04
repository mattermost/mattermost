// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {
    deleteChannelPostPropertyField,
    patchChannelPostPropertyField,
} from 'mattermost-redux/actions/properties';
import {ChannelPostPropertyGroupName} from 'mattermost-redux/constants/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ManagePostPropertiesModal from './manage_post_properties_modal';

jest.mock('mattermost-redux/actions/properties', () => ({
    patchChannelPostPropertyField: jest.fn(() => ({type: 'MOCK_PATCH'})),
    deleteChannelPostPropertyField: jest.fn(() => ({type: 'MOCK_DELETE'})),
}));

const patchChannelPostPropertyFieldMock = patchChannelPostPropertyField as jest.MockedFunction<
    typeof patchChannelPostPropertyField
>;
const deleteChannelPostPropertyFieldMock = deleteChannelPostPropertyField as jest.MockedFunction<
    typeof deleteChannelPostPropertyField
>;

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

const channelId = 'channel-1';

function buildState(fields: PropertyField[]) {
    const groupId = 'g1';
    return {
        entities: {
            properties: {
                groups: {
                    byId: {[groupId]: {id: groupId, name: ChannelPostPropertyGroupName}},
                    byName: {[ChannelPostPropertyGroupName]: {id: groupId, name: ChannelPostPropertyGroupName}},
                },
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {
                        post: {
                            [groupId]: Object.fromEntries(fields.map((f) => [f.id, f])),
                        },
                    },
                },
                values: {byTargetId: {}, byFieldId: {}},
            },
        },
    };
}

describe('components/manage_post_properties_modal/ManagePostPropertiesModal', () => {
    beforeEach(() => {
        patchChannelPostPropertyFieldMock.mockClear();
        deleteChannelPostPropertyFieldMock.mockClear();
    });

    test('lists all fields for the channel', () => {
        const fields = [
            makeField({id: 'f1', name: 'Status'}),
            makeField({id: 'f2', name: 'Priority'}),
        ];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        expect(screen.getByDisplayValue('Status')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Priority')).toBeInTheDocument();
    });

    test('renaming a field and clicking save dispatches patchChannelPostPropertyField', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        const input = screen.getByDisplayValue('Status');
        fireEvent.change(input, {target: {value: 'Stage'}});
        fireEvent.click(screen.getByRole('button', {name: /save f1/i}));

        expect(patchChannelPostPropertyFieldMock).toHaveBeenCalledWith('f1', {name: 'Stage'});
    });

    test('save is disabled when the name is unchanged', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        expect(screen.getByRole('button', {name: /save f1/i})).toBeDisabled();
    });

    test('save is disabled when the name is empty', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        const input = screen.getByDisplayValue('Status');
        fireEvent.change(input, {target: {value: '   '}});

        expect(screen.getByRole('button', {name: /save f1/i})).toBeDisabled();
    });

    test('delete shows a confirm prompt and only dispatches on confirm', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /delete f1/i}));
        expect(deleteChannelPostPropertyFieldMock).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', {name: /confirm delete/i}));
        expect(deleteChannelPostPropertyFieldMock).toHaveBeenCalledWith('f1');
    });

    test('cancelling the delete confirmation does not dispatch', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /delete f1/i}));
        fireEvent.click(screen.getByRole('button', {name: /cancel delete/i}));

        expect(deleteChannelPostPropertyFieldMock).not.toHaveBeenCalled();
    });

    test('shows an empty state when the channel has no fields', () => {
        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState([]),
        );

        expect(screen.getByText(/no properties yet/i)).toBeInTheDocument();
    });
});
