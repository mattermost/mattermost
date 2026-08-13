// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, waitFor, within} from '@testing-library/react';
import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SharedChannelsAddModal from './shared_channels_add_modal';

let mockLastChannelsInputProps: any;

jest.mock('components/widgets/inputs/channels_input', () => {
    return function MockChannelsInput(props: any) {
        mockLastChannelsInputProps = props;
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
        mockLastChannelsInputProps = undefined;
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

        act(() => {
            mockLastChannelsInputProps.onChange([channelA, channelB]);
        });

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

        act(() => {
            mockLastChannelsInputProps.onChange([channelA]);
        });

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

        act(() => {
            mockLastChannelsInputProps.onChange([channelA]);
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Share'})).toBeEnabled();
        });

        await user.click(screen.getByRole('button', {name: 'Share'}));

        await waitFor(() => {
            expect(screen.getByText(/could not be added to this connection/)).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).queryByRole('button', {name: 'Share'})).not.toBeInTheDocument();

        // The dialog has both a header dismiss button (aria-label="Close") and the
        // footer confirm button (text "Close" after the flip), so role+name alone
        // matches two elements. Scope the confirm-label assertion to the footer.
        const footer = dialog.querySelector('.modal-footer') as HTMLElement;
        expect(within(footer).getByRole('button', {name: 'Close'})).toBeInTheDocument();
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

        act(() => {
            mockLastChannelsInputProps.onChange([channelA]);
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Share'})).toBeEnabled();
        });
        await user.click(screen.getByRole('button', {name: 'Share'}));

        await waitFor(() => {
            expect(screen.getByText(/could not be added/)).toBeInTheDocument();
        });

        act(() => {
            mockLastChannelsInputProps.onChange([channelB]);
        });

        await waitFor(() => {
            expect(screen.queryByText(/could not be added/)).not.toBeInTheDocument();
        });
    });
});
