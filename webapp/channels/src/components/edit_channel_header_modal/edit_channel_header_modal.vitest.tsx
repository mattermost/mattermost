// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';
import * as Utils from 'utils/utils';

import {EditChannelHeaderModal} from './edit_channel_header_modal';

describe('components/EditChannelHeaderModal', () => {
    const timestamp = Utils.getTimestamp();
    const channel = {
        id: 'fake-id',
        create_at: timestamp,
        update_at: timestamp,
        delete_at: timestamp,
        team_id: 'fake-team-id',
        type: Constants.OPEN_CHANNEL as ChannelType,
        display_name: 'Fake Channel',
        name: 'Fake Channel',
        header: 'Fake Channel',
        purpose: 'purpose',
        last_post_at: timestamp,
        creator_id: 'fake-creator-id',
        scheme_id: 'fake-scheme-id',
        group_constrained: false,
        last_root_post_at: timestamp,
    };

    const baseProps = {
        markdownPreviewFeatureIsEnabled: false,
        channel,
        ctrlSend: false,
        show: false,
        shouldShowPreview: false,
        onExited: vi.fn(),
        actions: {
            setShowPreview: vi.fn(),
            patchChannel: vi.fn().mockResolvedValue({}),
        },
        intl: {
            formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
        } as any,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot, init', () => {
        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('edit direct message channel', () => {
        const dmChannel: Channel = {
            ...channel,
            type: Constants.DM_CHANNEL as ChannelType,
        };

        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                channel={dmChannel}
            />,
        );

        // DM channels show "Edit Header" without channel name
        expect(screen.getByRole('heading', {name: 'Edit Header'})).toBeInTheDocument();
    });

    test('submitted', async () => {
        const user = userEvent.setup();

        // Use a never-resolving promise to keep component in saving state
        const patchChannel = vi.fn().mockImplementation(() => new Promise(() => {}));
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                patchChannel,
            },
        };

        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        // Change header to enable save
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, 'New header');

        // Click save to enter saving state
        const saveButton = screen.getByRole('button', {name: /save/i});
        await user.click(saveButton);

        // Component is now in saving=true state
        expect(patchChannel).toHaveBeenCalled();
        expect(baseElement).toMatchSnapshot();
    });

    test('error with intl message', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        // Type a header that exceeds 1024 characters to trigger intl error
        const longHeader = 'a'.repeat(1025);
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, longHeader);

        // Error with server_error_id 'model.channel.is_valid.header.app_error' shows translated message
        await waitFor(() => {
            expect(screen.getByText(/character limit|1024 characters/i)).toBeInTheDocument();
        });
    });

    test('error without intl message', async () => {
        const user = userEvent.setup();
        const serverError = {
            server_error_id: 'some.other.error',
            message: 'Raw error message',
        };
        const patchChannel = vi.fn().mockResolvedValue({error: serverError});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                patchChannel,
            },
        };

        renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        // Change header and save
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, 'New header');

        const saveButton = screen.getByRole('button', {name: /save/i});
        await user.click(saveButton);

        // Should show raw error message
        await waitFor(() => {
            expect(screen.getByText('Raw error message')).toBeInTheDocument();
        });
    });

    describe('handleSave', () => {
        test('on no change, should hide the modal without trying to patch a channel', async () => {
            const user = userEvent.setup();
            const patchChannel = vi.fn().mockResolvedValue({});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    patchChannel,
                },
            };

            renderWithContext(
                <EditChannelHeaderModal {...props}/>,
            );

            // Click save without changing header
            const saveButton = screen.getByRole('button', {name: /save/i});
            await user.click(saveButton);

            // patchChannel should not be called when header hasn't changed
            expect(patchChannel).not.toHaveBeenCalled();

            // Modal should close
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        test('on error, should not close modal and set server error state', async () => {
            const user = userEvent.setup();
            const serverError = {
                server_error_id: 'fake-server-error',
                message: 'Server rejected the change',
            };
            const patchChannel = vi.fn().mockResolvedValue({error: serverError});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    patchChannel,
                },
            };

            renderWithContext(
                <EditChannelHeaderModal {...props}/>,
            );

            // Change header and save
            const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
            await user.clear(textbox);
            await user.type(textbox, 'New header');

            const saveButton = screen.getByRole('button', {name: /save/i});
            await user.click(saveButton);

            // Modal should remain open with error
            await waitFor(() => {
                expect(screen.getByText('Server rejected the change')).toBeInTheDocument();
            });
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        test('on success, should close modal', async () => {
            const user = userEvent.setup();
            const patchChannel = vi.fn().mockResolvedValue({});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    patchChannel,
                },
            };

            renderWithContext(
                <EditChannelHeaderModal {...props}/>,
            );

            // Change header and save
            const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
            await user.clear(textbox);
            await user.type(textbox, 'New header');

            const saveButton = screen.getByRole('button', {name: /save/i});
            await user.click(saveButton);

            // patchChannel should be called
            await waitFor(() => {
                expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: 'New header'});
            });

            // Modal should close on success
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });
    });

    test('change header', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, 'Updated header text');

        expect(textbox).toHaveValue('Updated header text');
    });

    test('patch on save button click', async () => {
        const user = userEvent.setup();
        const patchChannel = vi.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                patchChannel,
            },
        };

        renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        const newHeader = 'New channel header';
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, newHeader);

        const saveButton = screen.getByRole('button', {name: /save/i});
        await user.click(saveButton);

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('patch on enter keypress event with ctrl', async () => {
        const user = userEvent.setup();
        const patchChannel = vi.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            ctrlSend: true,
            actions: {
                ...baseProps.actions,
                patchChannel,
            },
        };

        renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        const newHeader = 'New channel header';
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, newHeader);

        // With ctrlSend=true, Ctrl+Enter should save
        await user.keyboard('{Control>}{Enter}{/Control}');

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('patch on enter keypress', async () => {
        const user = userEvent.setup();
        const patchChannel = vi.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            ctrlSend: false,
            actions: {
                ...baseProps.actions,
                patchChannel,
            },
        };

        renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        const newHeader = 'New channel header';
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, newHeader);

        // With ctrlSend=false, Enter should save
        await user.keyboard('{Enter}');

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('patch on enter keydown', async () => {
        const user = userEvent.setup();
        const patchChannel = vi.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            ctrlSend: true,
            actions: {
                ...baseProps.actions,
                patchChannel,
            },
        };

        renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        const newHeader = 'New channel header';
        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        await user.clear(textbox);
        await user.type(textbox, newHeader);

        // With ctrlSend=true, Ctrl+Enter triggers save via keydown
        await user.keyboard('{Control>}{Enter}{/Control}');

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('should show error only for invalid length', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const textbox = document.getElementById('edit_textbox') as HTMLTextAreaElement;

        // First set invalid header (exceeds 1024 chars)
        const longHeader = 'a'.repeat(1025);
        await user.clear(textbox);
        await user.type(textbox, longHeader);

        await waitFor(() => {
            expect(screen.getByText(/character limit|1024 characters/i)).toBeInTheDocument();
        });

        // Then set valid header - error should clear
        await user.clear(textbox);
        await user.type(textbox, 'valid header');

        await waitFor(() => {
            expect(screen.queryByText(/character limit|1024 characters/i)).not.toBeInTheDocument();
        });
    });
});
