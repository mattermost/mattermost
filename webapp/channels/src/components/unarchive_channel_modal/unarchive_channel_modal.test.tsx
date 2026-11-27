// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import useRequiredChannelAttributesToAsk from 'components/common/hooks/useRequiredChannelAttributesToAsk';
import ConnectedUnarchiveChannelModal from 'components/unarchive_channel_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';
import {TestHelper} from 'utils/test_helper';

import UnarchiveChannelModal from './unarchive_channel_modal';

jest.mock('components/common/hooks/useRequiredChannelAttributesToAsk');

type FormProps = {
    fields: Array<{id: string}>;
    onChange: (fieldId: string, value: string | string[] | undefined) => void;
};
jest.mock('components/channel_attributes/channel_attributes_form', () => (props: FormProps) => (
    <div>
        {props.fields.map((field) => (
            <button
                key={field.id}
                onClick={() => props.onChange(field.id, `value-${field.id}`)}
            >
                {`Fill ${field.id}`}
            </button>
        ))}
    </div>
));

function propertyField(overrides: Partial<PropertyField>): PropertyField {
    return {
        id: '',
        group_id: 'group1',
        name: '',
        type: 'text',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {},
        ...overrides,
    };
}

const mockUseRequiredChannelAttributesToAsk = jest.mocked(useRequiredChannelAttributesToAsk);

const NOTHING_TO_ASK = {fields: [], cannotSet: [], enabled: false, loading: false};

describe('components/unarchive_channel_modal', () => {
    const channel = TestHelper.getChannelMock({
        create_at: 1508265709607,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        delete_at: 0,
        display_name: 'testing',
        header: 'test',
        id: 'owsyt8n43jfxjpzh9np93mx1wa',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        type: 'O',
        update_at: 1508265709607,
    });

    const baseProps = {
        channel,
        actions: {
            unarchiveChannel: jest.fn(),
        },
        onExited: jest.fn(),
    };

    beforeEach(() => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue(NOTHING_TO_ASK);
    });

    test('should have called actions.unarchiveChannel when Unarchive is clicked', async () => {
        const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, actions: {unarchiveChannel}};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

        expect(unarchiveChannel).toHaveBeenCalledTimes(1);
        expect(unarchiveChannel).toHaveBeenCalledWith(props.channel.id);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('focuses the confirm button so Enter restores the channel', async () => {
        const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
        renderWithContext(
            <UnarchiveChannelModal
                {...baseProps}
                actions={{unarchiveChannel}}
            />,
        );

        await waitFor(() => expect(screen.getByRole('button', {name: 'Unarchive'})).toHaveFocus());
        await userEvent.keyboard('{Enter}');

        expect(unarchiveChannel).toHaveBeenCalledWith(channel.id);
    });

    test('Enter does nothing until the required attribute lookup has finished', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({...NOTHING_TO_ASK, enabled: true, loading: true});
        const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
        renderWithContext(
            <UnarchiveChannelModal
                {...baseProps}
                actions={{unarchiveChannel}}
            />,
        );

        await waitFor(() => expect(screen.getByRole('button', {name: 'Unarchive'})).toHaveFocus());
        await userEvent.keyboard('{Enter}');

        expect(unarchiveChannel).not.toHaveBeenCalled();
    });

    test('keeps focus on the confirm button once the lookup finishes, so Enter restores the channel', async () => {
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({...NOTHING_TO_ASK, enabled: true, loading: true});
        const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, actions: {unarchiveChannel}};
        const {rerender} = renderWithContext(<UnarchiveChannelModal {...props}/>);

        await waitFor(() => expect(screen.getByRole('button', {name: 'Unarchive'})).toHaveFocus());

        mockUseRequiredChannelAttributesToAsk.mockReturnValue({...NOTHING_TO_ASK, enabled: true, loading: false});
        rerender(<UnarchiveChannelModal {...props}/>);

        expect(screen.getByRole('button', {name: 'Unarchive'})).toHaveFocus();
        await userEvent.keyboard('{Enter}');

        expect(unarchiveChannel).toHaveBeenCalledWith(channel.id);
    });

    test('should have called props.onExited on Cancel', async () => {
        const onExited = jest.fn();
        renderWithContext(
            <UnarchiveChannelModal
                {...baseProps}
                onExited={onExited}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => {
            expect(onExited).toHaveBeenCalledTimes(1);
        });
    });

    describe('with required channel attributes', () => {
        const askFor = (ids: string[]) => ({
            fields: ids.map((id) => propertyField({id, name: id, type: 'select', attrs: {required: true}})),
            cannotSet: [],
            enabled: true,
            loading: false,
        });

        test('plain state: no fields, no notice, plain Unarchive button, no bypass', () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({...NOTHING_TO_ASK, enabled: true});
            renderWithContext(<UnarchiveChannelModal {...baseProps}/>);

            expect(screen.getByRole('button', {name: 'Unarchive'})).toBeEnabled();
            expect(screen.queryByTestId('unarchiveChannelModalRequiredAttributes')).not.toBeInTheDocument();
            expect(screen.queryByTestId('unarchiveChannelModalFlaggedNotice')).not.toBeInTheDocument();
            expect(screen.queryByText(/anyway/i)).not.toBeInTheDocument();
        });

        test('asks for the hook with the channel and its team', () => {
            renderWithContext(<UnarchiveChannelModal {...baseProps}/>);

            expect(mockUseRequiredChannelAttributesToAsk).toHaveBeenCalledWith({teamId: channel.team_id, channelId: channel.id}, {requiredOnly: true});
        });

        test('fields state: shows the fields, disables Set and unarchive until all are filled, sends the values', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue(askFor(['f1', 'f2']));
            const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            expect(screen.getByText('This channel has no value for these required attributes:')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Unarchive'})).not.toBeInTheDocument();
            expect(screen.queryByText(/anyway/i)).not.toBeInTheDocument();
            const confirm = screen.getByRole('button', {name: 'Set and unarchive'});
            expect(confirm).toBeDisabled();

            await userEvent.click(screen.getByRole('button', {name: 'Fill f1'}));
            expect(confirm).toBeDisabled();
            await userEvent.click(screen.getByRole('button', {name: 'Fill f2'}));
            expect(confirm).toBeEnabled();

            await userEvent.click(confirm);

            expect(unarchiveChannel).toHaveBeenCalledWith(channel.id, [
                {field_id: 'f1', value: 'value-f1'},
                {field_id: 'f2', value: 'value-f2'},
            ]);
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        test('confirm does nothing while the fields are still loading', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({...NOTHING_TO_ASK, enabled: true, loading: true});
            const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

            expect(unarchiveChannel).not.toHaveBeenCalled();
        });

        test('error state: keeps the fields and the picked values, shows the server message, retries', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue(askFor(['f1']));
            const unarchiveChannel = jest.fn().
                mockResolvedValueOnce({error: {message: 'Value not allowed.'}}).
                mockResolvedValueOnce({data: true});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Fill f1'}));
            await userEvent.click(screen.getByRole('button', {name: 'Set and unarchive'}));

            await waitFor(() => expect(screen.getByText('We couldn\'t unarchive the channel. Value not allowed.')).toBeInTheDocument());
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Fill f1'})).toBeInTheDocument();
            const retry = screen.getByRole('button', {name: 'Set and unarchive'});
            expect(retry).toBeEnabled();

            await userEvent.click(retry);

            await waitFor(() => expect(unarchiveChannel).toHaveBeenCalledTimes(2));
            expect(unarchiveChannel).toHaveBeenLastCalledWith(channel.id, [{field_id: 'f1', value: 'value-f1'}]);
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        test('flagged state: info notice and a plain Unarchive that sends no values', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({
                fields: [],
                cannotSet: [propertyField({id: 'f1', name: 'f1', attrs: {required: true}})],
                enabled: true,
                loading: false,
            });
            const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            expect(screen.getByText('You can\'t set some required attributes on this channel. Channel admins who can set them will be notified after you unarchive it.')).toBeInTheDocument();
            expect(screen.queryByTestId('unarchiveChannelModalRequiredAttributes')).not.toBeInTheDocument();
            expect(screen.queryByText(/anyway/i)).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

            expect(unarchiveChannel).toHaveBeenCalledWith(channel.id);
        });

        test('promises no message for missing attributes nobody can edit', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({
                fields: [],
                cannotSet: [propertyField({id: 'f1', name: 'f1', type: 'date', attrs: {required: true}})],
                enabled: true,
                loading: false,
            });
            const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            expect(screen.queryByText(/They'll be notified/)).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

            expect(unarchiveChannel).toHaveBeenCalledWith(channel.id);
        });

        test('mixed state: shows the fields and the notice for the ones only admins can set', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({
                ...askFor(['f1']),
                cannotSet: [propertyField({id: 'f2', name: 'f2', attrs: {required: true}})],
            });
            const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            expect(screen.getByTestId('unarchiveChannelModalRequiredAttributes')).toBeInTheDocument();
            expect(screen.getByText('You can\'t set some required attributes on this channel. Channel admins who can set them will be notified after you unarchive it.')).toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Fill f1'}));
            await userEvent.click(screen.getByRole('button', {name: 'Set and unarchive'}));

            expect(unarchiveChannel).toHaveBeenCalledWith(channel.id, [{field_id: 'f1', value: 'value-f1'}]);
        });

        test('feature off: plain dialog, plain call, raw server error as before', async () => {
            const unarchiveChannel = jest.fn().mockResolvedValue({error: {message: 'Something went wrong'}});
            renderWithContext(
                <UnarchiveChannelModal
                    {...baseProps}
                    actions={{unarchiveChannel}}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

            expect(unarchiveChannel).toHaveBeenCalledWith(channel.id);
            await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
            expect(screen.queryByText(/We couldn't unarchive/)).not.toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    test('stays open and shows the server error when unarchiveChannel fails', async () => {
        const unarchiveChannel = jest.fn().mockResolvedValue({error: {message: 'Something went wrong'}});
        const props = {...baseProps, actions: {unarchiveChannel}};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

        await waitFor(() => {
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('says board for a board', () => {
        renderWithContext(
            <ConnectedUnarchiveChannelModal
                channel={channel}
                onExited={jest.fn()}
            />,
            boardChannelsState(channel.id),
        );

        expect(screen.getByText('Confirm UNARCHIVE Board')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you wish to unarchive the/)).toHaveTextContent('Are you sure you wish to unarchive the testing board?');
        expect(screen.queryByText(/channel/i)).not.toBeInTheDocument();
    });
});
