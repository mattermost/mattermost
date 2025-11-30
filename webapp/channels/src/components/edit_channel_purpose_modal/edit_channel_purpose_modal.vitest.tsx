// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelPurposeModal from './edit_channel_purpose_modal';

describe('comoponents/EditChannelPurposeModal', () => {
    const channel = TestHelper.getChannelMock({
        purpose: 'testPurpose',
    });

    const baseProps = {
        channel,
        ctrlSend: true,
        onExited: vi.fn(),
        actions: {patchChannel: vi.fn().mockResolvedValue({data: true})},
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should match on init', () => {
        const {baseElement} = renderWithContext(
            <EditChannelPurposeModal {...baseProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    it('should match with display name', () => {
        const channelWithDisplayName = {
            ...channel,
            display_name: 'channel name',
        };

        const {baseElement} = renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                channel={channelWithDisplayName}
            />,
        );

        expect(baseElement).toMatchSnapshot();
    });

    it('should match for private channel', () => {
        const privateChannel: Channel = {
            ...channel,
            type: 'P',
        };

        const {baseElement} = renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                channel={privateChannel}
            />,
        );

        expect(baseElement).toMatchSnapshot();
    });

    it('should match submitted', async () => {
        const patchChannel = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
        const props = {
            ...baseProps,
            actions: {patchChannel},
        };

        renderWithContext(
            <EditChannelPurposeModal {...props}/>,
        );

        // Click save button
        const saveButton = screen.getByRole('button', {name: /save/i});
        fireEvent.click(saveButton);

        // Save button should be disabled while request is in progress
        await waitFor(() => {
            expect(saveButton).toBeDisabled();
        });
    });

    it('match with modal error', async () => {
        const serverError = {
            id: 'api.context.invalid_param.app_error',
            message: 'error message',
        };
        const patchChannel = vi.fn().mockResolvedValue({error: serverError});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                actions={{patchChannel}}
            />,
        );

        // Click save
        const saveButton = screen.getByRole('button', {name: /save/i});
        fireEvent.click(saveButton);

        // Error should be displayed
        await waitFor(() => {
            expect(screen.getByText(serverError.message)).toBeInTheDocument();
        });
    });

    it('match with modal error with fake id', async () => {
        const serverError = {
            id: 'fake-error-id',
            message: 'fake error',
        };
        const patchChannel = vi.fn().mockResolvedValue({error: serverError});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                actions={{patchChannel}}
            />,
        );

        // Click save
        const saveButton = screen.getByRole('button', {name: /save/i});
        fireEvent.click(saveButton);

        // Error with fake id should also be displayed
        await waitFor(() => {
            expect(screen.getByText(serverError.message)).toBeInTheDocument();
        });
    });

    it('clear error on next', async () => {
        const serverError = {
            id: 'fake-error-id',
            message: 'error message',
        };
        const patchChannel = vi.fn().
            mockResolvedValueOnce({error: serverError}).
            mockResolvedValueOnce({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                actions={{patchChannel}}
            />,
        );

        // Click save - first call will fail
        const saveButton = screen.getByRole('button', {name: /save/i});
        fireEvent.click(saveButton);

        // Error should be displayed
        await waitFor(() => {
            expect(screen.getByText(serverError.message)).toBeInTheDocument();
        });

        // Click save again - second call will succeed
        fireEvent.click(saveButton);

        // Error should be cleared on success
        await waitFor(() => {
            expect(screen.queryByText(serverError.message)).not.toBeInTheDocument();
        });
    });

    it('update purpose state', () => {
        renderWithContext(
            <EditChannelPurposeModal {...baseProps}/>,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, {target: {value: 'new info'}});

        expect(textarea).toHaveValue('new info');
    });

    it('hide on success', async () => {
        const onExited = vi.fn();
        const patchChannel = vi.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                onExited={onExited}
                actions={{patchChannel}}
            />,
        );

        // Click save
        const saveButton = screen.getByRole('button', {name: /save/i});
        fireEvent.click(saveButton);

        // Modal should close on success
        await waitFor(() => {
            expect(onExited).toHaveBeenCalled();
        });
    });

    it('submit on save button click', async () => {
        const patchChannel = vi.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                actions={{patchChannel}}
            />,
        );

        // Click save button
        const saveButton = screen.getByRole('button', {name: /save/i});
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {purpose: 'testPurpose'});
        });
    });

    it('submit on ctrl + enter', async () => {
        const patchChannel = vi.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                ctrlSend={true}
                actions={{patchChannel}}
            />,
        );

        const textarea = screen.getByRole('textbox');

        // Press Ctrl+Enter
        fireEvent.keyDown(textarea, {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            ctrlKey: true,
        });

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {purpose: 'testPurpose'});
        });
    });

    it('submit on enter', async () => {
        const patchChannel = vi.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                {...baseProps}
                ctrlSend={false}
                actions={{patchChannel}}
            />,
        );

        const textarea = screen.getByRole('textbox');

        // Press Enter without Ctrl when ctrlSend is false
        fireEvent.keyDown(textarea, {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            ctrlKey: false,
        });

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {purpose: 'testPurpose'});
        });
    });
});
