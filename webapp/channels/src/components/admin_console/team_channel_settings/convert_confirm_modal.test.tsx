// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import useRequiredChannelAttributesToAsk from 'components/common/hooks/useRequiredChannelAttributesToAsk';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ConvertAndRemoveConfirmModal from './convert_and_remove_confirm_modal';
import ConvertConfirmModal from './convert_confirm_modal';

jest.mock('components/common/hooks/useRequiredChannelAttributesToAsk');
const mockUseRequiredChannelAttributesToAsk = jest.mocked(useRequiredChannelAttributesToAsk);

type FormProps = {
    fields: PropertyField[];
    onChange: (fieldId: string, value: string | string[] | undefined) => void;
};
jest.mock('components/channel_attributes/channel_attributes_form', () => (props: FormProps) => (
    <div>
        {props.fields.map((field) => (
            <button
                key={field.id}
                onClick={() => props.onChange(field.id, 'option1')}
            >
                {`Fill ${field.id}`}
            </button>
        ))}
    </div>
));

function attributeField(id: string): PropertyField {
    return {
        id,
        group_id: 'group1',
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: 'admin',
        attrs: {required: true, display_name: id, options: [{id: 'option1', name: 'Option One'}]},
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

const intro = 'This channel has no value for these required attributes:';

describe('admin_console/team_channel_settings/ConvertConfirmModal', () => {
    const baseProps = {
        show: true,
        onCancel: jest.fn(),
        onConfirm: jest.fn(),
        displayName: 'Town Square',
        toPublic: false,
        channelId: 'channel1',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [], cannotSet: [], enabled: true, loading: false});
    });

    test('never disables the confirm button while attributes are not enabled, even if reported loading', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [], cannotSet: [], enabled: false, loading: true});
        renderWithContext(<ConvertConfirmModal {...baseProps}/>);

        expect(screen.getByRole('button', {name: 'Yes, convert to private channel'})).toBeEnabled();
    });

    test('shows today\'s dialog when nothing is missing', async () => {
        renderWithContext(<ConvertConfirmModal {...baseProps}/>);

        expect(mockUseRequiredChannelAttributesToAsk).toHaveBeenCalledWith({teamId: '', channelId: 'channel1'}, {requiredOnly: true, skip: false});
        expect(screen.queryByText(intro)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Yes, convert to private channel'}));
        expect(baseProps.onConfirm).toHaveBeenCalledWith(undefined);
    });

    test('does not look anything up without a channel id, when closed, or when converting to public', () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1')], cannotSet: [], enabled: true, loading: true});
        const {rerender} = renderWithContext(<ConvertConfirmModal {...{...baseProps, channelId: undefined}}/>);
        rerender(<ConvertConfirmModal {...{...baseProps, show: false}}/>);
        rerender(<ConvertConfirmModal {...{...baseProps, toPublic: true}}/>);

        for (const [, options] of mockUseRequiredChannelAttributesToAsk.mock.calls) {
            expect(options).toEqual({requiredOnly: true, skip: true});
        }
        expect(screen.queryByText(intro)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Yes, convert to public channel'})).toBeEnabled();
    });

    test('starts empty each time it opens', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1')], cannotSet: [], enabled: true, loading: false});
        const {rerender} = renderWithContext(<ConvertConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Fill f1'}));
        expect(screen.getByRole('button', {name: 'Yes, convert to private channel'})).toBeEnabled();

        rerender(<ConvertConfirmModal {...{...baseProps, show: false}}/>);
        rerender(<ConvertConfirmModal {...baseProps}/>);

        expect(await screen.findByRole('button', {name: 'Yes, convert to private channel'})).toBeDisabled();
    });

    test('keeps confirm disabled until the missing attributes are filled, then passes the values', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1')], cannotSet: [], enabled: true, loading: false});

        renderWithContext(<ConvertConfirmModal {...baseProps}/>);

        expect(screen.getByText(intro)).toBeInTheDocument();
        const confirm = screen.getByRole('button', {name: 'Yes, convert to private channel'});
        expect(confirm).toBeDisabled();

        await userEvent.click(screen.getByRole('button', {name: 'Fill f1'}));
        expect(confirm).toBeEnabled();

        await userEvent.click(confirm);
        expect(baseProps.onConfirm).toHaveBeenCalledWith([{field_id: 'f1', value: 'option1'}]);
    });

    test('does not ask for attributes the caller already has pending values for', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1'), attributeField('f2')], cannotSet: [], enabled: true, loading: false});

        renderWithContext(
            <ConvertConfirmModal
                {...baseProps}
                pendingValues={{f1: 'option1', f2: null}}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Fill f1'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Fill f2'}));
        await userEvent.click(screen.getByRole('button', {name: 'Yes, convert to private channel'}));

        expect(baseProps.onConfirm).toHaveBeenCalledWith([{field_id: 'f2', value: 'option1'}]);
    });

    test('shows today\'s dialog when every missing attribute has a pending value', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1')], cannotSet: [], enabled: true, loading: false});

        renderWithContext(
            <ConvertConfirmModal
                {...baseProps}
                pendingValues={{f1: 'option1'}}
            />,
        );

        expect(screen.queryByText(intro)).not.toBeInTheDocument();
        const confirm = screen.getByRole('button', {name: 'Yes, convert to private channel'});
        expect(confirm).toBeEnabled();

        await userEvent.click(confirm);
        expect(baseProps.onConfirm).toHaveBeenCalledWith(undefined);
    });

    test('keeps confirm disabled while the attributes load', () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [], cannotSet: [], enabled: true, loading: true});

        renderWithContext(<ConvertConfirmModal {...baseProps}/>);

        expect(screen.getByRole('button', {name: 'Yes, convert to private channel'})).toBeDisabled();
    });

    test('never blocks confirm when the feature is off', () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [], cannotSet: [], enabled: false, loading: true});

        renderWithContext(<ConvertConfirmModal {...baseProps}/>);

        expect(screen.getByRole('button', {name: 'Yes, convert to private channel'})).toBeEnabled();
    });
});

describe('admin_console/team_channel_settings/ConvertAndRemoveConfirmModal', () => {
    const baseProps = {
        show: true,
        onCancel: jest.fn(),
        onConfirm: jest.fn(),
        displayName: 'Town Square',
        toPublic: false,
        removeAmount: 2,
        channelId: 'channel1',
    };
    const confirmName = 'Yes, convert channel to private and remove 2 users';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('asks for the missing attributes and passes the values', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1')], cannotSet: [], enabled: true, loading: false});

        renderWithContext(<ConvertAndRemoveConfirmModal {...baseProps}/>);

        expect(screen.getByText(intro)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: confirmName})).toBeDisabled();

        await userEvent.click(screen.getByRole('button', {name: 'Fill f1'}));
        await userEvent.click(screen.getByRole('button', {name: confirmName}));

        expect(baseProps.onConfirm).toHaveBeenCalledWith([{field_id: 'f1', value: 'option1'}]);
    });

    test('is unchanged when converting to public', () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [attributeField('f1')], cannotSet: [], enabled: true, loading: false});
        renderWithContext(
            <ConvertAndRemoveConfirmModal
                {...baseProps}
                toPublic={true}
            />,
        );

        expect(mockUseRequiredChannelAttributesToAsk).toHaveBeenCalledWith({teamId: '', channelId: 'channel1'}, {requiredOnly: true, skip: true});
        expect(screen.queryByText(intro)).not.toBeInTheDocument();
    });
});
