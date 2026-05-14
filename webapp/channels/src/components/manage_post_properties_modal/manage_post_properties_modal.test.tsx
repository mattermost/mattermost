// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

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

function makeSelectField(id: string, name: string, options: PropertyFieldOption[]): PropertyField {
    return makeField({
        id,
        name,
        type: 'select',
        attrs: {options} as PropertyField['attrs'],
    });
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

    test('renders one read-mode row per field; no name inputs visible by default', () => {
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

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();

        // Read mode — no textboxes anywhere yet.
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    test('select field renders option chips with their colors in read mode', () => {
        const fields = [
            makeSelectField('fs', 'Priority', [
                {id: 'o1', name: 'Low', color: '#abcdef'},
                {id: 'o2', name: 'High', color: '#fedcba'},
            ]),
        ];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        expect(screen.getByText('Low')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
    });

    test('each row exposes edit and delete buttons with accessible names', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        const editBtn = screen.getByRole('button', {name: /edit f1/i});
        const deleteBtn = screen.getByRole('button', {name: /delete f1/i});
        expect(editBtn).toBeEnabled();
        expect(deleteBtn).toBeEnabled();
    });

    test('clicking edit enters edit mode: name Input + type LabeledSelect appear', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));

        expect(screen.getByLabelText(/^Status$/i)).toHaveValue('Status');
        expect(screen.getByRole('combobox')).toBeInTheDocument();
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

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        fireEvent.change(screen.getByLabelText(/^Status$/i), {target: {value: 'Stage'}});
        fireEvent.click(screen.getByRole('button', {name: /save f1/i}));

        expect(patchChannelPostPropertyFieldMock).toHaveBeenCalledWith('f1', {name: 'Stage'});
    });

    test('cancelling edit reverts drafts and does not dispatch', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        fireEvent.change(screen.getByLabelText(/^Status$/i), {target: {value: 'Stage'}});
        fireEvent.click(screen.getByRole('button', {name: /cancel edit f1/i}));

        expect(patchChannelPostPropertyFieldMock).not.toHaveBeenCalled();
        expect(screen.getByText('Status')).toBeInTheDocument();
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

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
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

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        fireEvent.change(screen.getByLabelText(/^Status$/i), {target: {value: '   '}});
        expect(screen.getByRole('button', {name: /save f1/i})).toBeDisabled();
    });

    test('changing type to select adds option editing controls', () => {
        const fields = [makeField({id: 'f1', name: 'Status', type: 'text'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        expect(screen.queryByRole('button', {name: /add option/i})).not.toBeInTheDocument();

        const combobox = screen.getByRole('combobox');

        // react-select opens its menu on ArrowDown when focused.
        fireEvent.focus(combobox);
        fireEvent.keyDown(combobox, {key: 'ArrowDown'});

        // The menu is rendered inline (no portal) — find the Select option.
        fireEvent.click(screen.getByText(/^Select$/));

        expect(screen.getByRole('button', {name: /add option/i})).toBeInTheDocument();
    });

    test('clicking delete opens the ConfirmModal; cancel does not dispatch', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /delete f1/i}));

        // ConfirmModal opens — body contains the localized message naming the field.
        expect(screen.getByText(/delete property "status"/i)).toBeInTheDocument();
        expect(deleteChannelPostPropertyFieldMock).not.toHaveBeenCalled();

        // Cancel via the ConfirmModal's cancel button.
        fireEvent.click(screen.getByTestId('cancel-button'));
        expect(deleteChannelPostPropertyFieldMock).not.toHaveBeenCalled();
    });

    test('confirming the delete dialog dispatches deleteChannelPostPropertyField', () => {
        const fields = [makeField({id: 'f1', name: 'Status'})];

        renderWithContext(
            <ManagePostPropertiesModal
                channelId={channelId}
                onExited={jest.fn()}
            />,
            buildState(fields),
        );

        fireEvent.click(screen.getByRole('button', {name: /delete f1/i}));
        fireEvent.click(screen.getByRole('button', {name: /^delete$/i}));

        expect(deleteChannelPostPropertyFieldMock).toHaveBeenCalledWith('f1');
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
