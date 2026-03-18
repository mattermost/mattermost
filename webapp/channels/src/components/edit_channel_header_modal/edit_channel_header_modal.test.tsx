// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {EditChannelHeaderModal} from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {type MockIntl} from 'tests/helpers/intl-test-helper';
import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';
import {renderWithContext, screen, userEvent, fireEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import * as Utils from 'utils/utils';

const KeyCodes = Constants.KeyCodes;

describe('components/EditChannelHeaderModal', () => {
    const timestamp = Utils.getTimestamp();
    const channel: Channel = {
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

    const serverError = {
        server_error_id: 'fake-server-error',
        message: 'some error',
    };

    const baseProps = {
        markdownPreviewFeatureIsEnabled: false,
        channel,
        ctrlSend: false,
        show: false,
        shouldShowPreview: false,
        onExited: jest.fn(),
        actions: {
            setShowPreview: jest.fn(),
            patchChannel: jest.fn().mockResolvedValue({}),
        },
        intl: {
            formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
        } as MockIntl,
    };

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

        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                channel={dmChannel}
            />,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('submitted', async () => {
        const patchChannel = jest.fn().mockImplementation(() => new Promise(() => {})); // Never resolves to keep saving state
        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        // Type a new header to enable save
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'New header');

        // Click save
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(baseElement).toMatchSnapshot();
    });

    test('error with intl message', async () => {
        const patchChannel = jest.fn().mockResolvedValue({
            error: {...serverError, server_error_id: 'model.channel.is_valid.header.app_error'},
        });
        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        // Type a new header
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'New header');

        // Click save
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(screen.getByText(/The text entered exceeds the character limit/)).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('error without intl message', async () => {
        const patchChannel = jest.fn().mockResolvedValue({error: serverError});
        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        // Type a new header
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'New header');

        // Click save
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(screen.getByText('some error')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();
    });

    describe('handleSave', () => {
        test('on no change, should hide the modal without trying to patch a channel', async () => {
            const patchChannel = jest.fn().mockResolvedValue({});
            renderWithContext(
                <EditChannelHeaderModal
                    {...baseProps}
                    actions={{...baseProps.actions, patchChannel}}
                />,
            );

            // Click save without making changes
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            // Modal should be hidden
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            expect(patchChannel).not.toHaveBeenCalled();
        });

        test('on error, should not close modal and set server error state', async () => {
            const patchChannel = jest.fn().mockResolvedValue({error: serverError});
            renderWithContext(
                <EditChannelHeaderModal
                    {...baseProps}
                    actions={{...baseProps.actions, patchChannel}}
                />,
            );

            // Type a new header
            const textbox = screen.getByRole('textbox');
            await userEvent.clear(textbox);
            await userEvent.type(textbox, 'New header');

            // Click save
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            // Modal should still be visible
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // Error should be displayed
            await waitFor(() => {
                expect(screen.getByText('some error')).toBeInTheDocument();
            });

            expect(patchChannel).toHaveBeenCalled();
        });

        test('on success, should close modal', async () => {
            const patchChannel = jest.fn().mockResolvedValue({});
            renderWithContext(
                <EditChannelHeaderModal
                    {...baseProps}
                    actions={{...baseProps.actions, patchChannel}}
                />,
            );

            // Type a new header
            const textbox = screen.getByRole('textbox');
            await userEvent.clear(textbox);
            await userEvent.type(textbox, 'New header');

            // Click save
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            // Modal should be hidden
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            expect(patchChannel).toHaveBeenCalled();
        });
    });

    test('change header', async () => {
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'header');

        expect(textbox).toHaveValue('header');
    });

    test('patch on save button click', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        const newHeader = 'New channel header';
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, newHeader);

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
    });

    test('patch on enter keypress event with ctrl', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                ctrlSend={true}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        const newHeader = 'New channel header';
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, newHeader);

        // Use keyDown as it works better in jsdom and triggers the same code path
        fireEvent.keyDown(textbox, {
            key: KeyCodes.ENTER[0],
            keyCode: KeyCodes.ENTER[1],
            which: KeyCodes.ENTER[1],
            shiftKey: false,
            altKey: false,
            ctrlKey: true,
        });

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('patch on enter keypress', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        const newHeader = 'New channel header';
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);

        // Type the header and press Enter in one go - userEvent.type handles the enter key properly
        await userEvent.type(textbox, newHeader + '{Enter}');

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('patch on enter keydown', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                ctrlSend={true}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        const newHeader = 'New channel header';
        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, newHeader);

        fireEvent.keyDown(textbox, {
            key: KeyCodes.ENTER[0],
            keyCode: KeyCodes.ENTER[1],
            which: KeyCodes.ENTER[1],
            shiftKey: false,
            altKey: false,
            ctrlKey: true,
        });

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: newHeader});
        });
    });

    test('should show error only for invalid length', async () => {
        // Render with a header value that's already very long (just under limit)
        const initialLongHeader = 'a'.repeat(1020);
        const {baseElement} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                channel={{...channel, header: initialLongHeader}}
            />,
        );

        // Initially no error (1020 chars is under 1024 limit)
        expect(baseElement.querySelector('.has-error')).not.toBeInTheDocument();

        // Get textarea and add more characters to exceed limit
        const textarea = screen.getByTestId('edit_textbox');

        // Type a few more characters to exceed limit
        await userEvent.type(textarea, 'aaaaa'); // Now 1025 chars

        await waitFor(() => {
            expect(baseElement.querySelector('.has-error')).toBeInTheDocument();
        });

        // Clear and type valid header
        await userEvent.clear(textarea);
        await userEvent.type(textarea, 'valid');

        await waitFor(() => {
            expect(baseElement.querySelector('.has-error')).not.toBeInTheDocument();
        });
    });

    testComponentForLineBreak(
        (value: string) => (
            <EditChannelHeaderModal
                {...baseProps}
                channel={{
                    ...baseProps.channel,
                    header: value,
                }}
            />
        ),
        (instance: React.Component<any, any>) => instance.state.header,
        false,
    );
});
