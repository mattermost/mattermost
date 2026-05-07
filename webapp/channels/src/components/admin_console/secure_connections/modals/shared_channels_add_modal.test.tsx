// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SharedChannelsAddModal from './shared_channels_add_modal';

let lastChannelsInputProps: any;

jest.mock('components/widgets/inputs/channels_input', () => {
    return function MockChannelsInput(props: any) {
        lastChannelsInputProps = props;
        return (
            <div
                data-testid='channels-input'
                aria-label={props.ariaLabel}
            />
        );
    };
});

jest.mock('../utils', () => {
    const actual = jest.requireActual('../utils');
    return {
        ...actual,
        useSharedChannelRemotes: () => [undefined, {loading: false, error: undefined, fetch: jest.fn()}],
    };
});

const channelA = {id: 'ch-a', display_name: 'Channel A'} as ChannelWithTeamData;
const channelB = {id: 'ch-b', display_name: 'Channel B'} as ChannelWithTeamData;

describe('SharedChannelsAddModal', () => {
    beforeEach(() => {
        lastChannelsInputProps = undefined;
    });

    it('renders the title and the channels input', () => {
        renderWithContext(
            <SharedChannelsAddModal
                onConfirm={jest.fn().mockResolvedValue({data: {}, errors: {}})}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
                remoteId='rc-1'
            />,
        );

        expect(screen.getByText('Select channels')).toBeInTheDocument();
        expect(screen.getByTestId('channels-input')).toBeInTheDocument();
    });

    it('disables the Share button until channels are selected', async () => {
        renderWithContext(
            <SharedChannelsAddModal
                onConfirm={jest.fn().mockResolvedValue({data: {}, errors: {}})}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
                remoteId='rc-1'
            />,
        );

        expect(screen.getByRole('button', {name: 'Share'})).toBeDisabled();

        lastChannelsInputProps.onChange([channelA, channelB]);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Share'})).toBeEnabled();
        });
    });

    it('calls onConfirm with selected channels and closes when there are no errors', async () => {
        const user = userEvent.setup();
        const onConfirm = jest.fn().mockResolvedValue({data: {}, errors: {}});
        const onHide = jest.fn();

        renderWithContext(
            <SharedChannelsAddModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={onHide}
                remoteId='rc-1'
            />,
        );

        lastChannelsInputProps.onChange([channelA]);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Share'})).toBeEnabled();
        });

        await user.click(screen.getByRole('button', {name: 'Share'}));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith([channelA]);
        });
        await waitFor(() => {
            expect(onHide).toHaveBeenCalledTimes(1);
        });
    });

    it('renders error notices and switches confirm label to Close when onConfirm returns errors', async () => {
        const user = userEvent.setup();
        const onConfirm = jest.fn().mockResolvedValue({
            data: {},
            errors: {
                'ch-a': {server_error_id: 'api.command_share.channel_invite_not_home.error', message: 'nope'},
            },
        });

        renderWithContext(
            <SharedChannelsAddModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
                remoteId='rc-1'
            />,
        );

        lastChannelsInputProps.onChange([channelA]);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Share'})).toBeEnabled();
        });

        await user.click(screen.getByRole('button', {name: 'Share'}));

        await waitFor(() => {
            expect(screen.getByText(/could not be added to this connection/)).toBeInTheDocument();
        });

        const confirmButton = document.querySelector('.modal-footer button.confirm');
        expect(confirmButton).toHaveTextContent('Close');
    });

    it('drops errors for channels removed from the selection', async () => {
        const user = userEvent.setup();
        const onConfirm = jest.fn().mockResolvedValue({
            data: {},
            errors: {
                'ch-a': {server_error_id: 'some.error', message: 'nope'},
            },
        });

        renderWithContext(
            <SharedChannelsAddModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
                remoteId='rc-1'
            />,
        );

        lastChannelsInputProps.onChange([channelA]);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Share'})).toBeEnabled();
        });
        await user.click(screen.getByRole('button', {name: 'Share'}));

        await waitFor(() => {
            expect(screen.getByText(/could not be added/)).toBeInTheDocument();
        });

        lastChannelsInputProps.onChange([channelB]);

        await waitFor(() => {
            expect(screen.queryByText(/could not be added/)).not.toBeInTheDocument();
        });
    });
});
