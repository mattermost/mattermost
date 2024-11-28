// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {EditChannelHeaderModal} from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {renderWithIntl} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import * as Utils from 'utils/utils';

const KeyCodes = Constants.KeyCodes;

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
            formatMessage: ({defaultMessage}) => defaultMessage,
        } as MockIntl,
    };

    test('should render the modal correctly', () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        expect(screen.getByText('Edit Header for Fake Channel')).toBeInTheDocument();
        expect(screen.getByText('Edit the text appearing next to the channel name in the header.')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    });

    test('should render direct message header correctly', () => {
        const dmChannel: Channel = {
            ...channel,
            type: Constants.DM_CHANNEL as ChannelType,
        };

        renderWithIntl(
            <EditChannelHeaderModal
                {...baseProps}
                channel={dmChannel}
            />,
        );

        expect(screen.getByText('Edit Header')).toBeInTheDocument();
    });

    test('should disable save button when saving', () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const saveButton = screen.getByRole('button', {name: 'Save'});
        userEvent.click(saveButton);
        
        expect(saveButton).toBeDisabled();
    });

    test('should show error message for invalid header length', () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'a'.repeat(1025));

        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
    });

    test('should show generic error message', () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'new header');
        
        baseProps.actions.patchChannel.mockResolvedValueOnce({error: serverError});
        
        userEvent.click(screen.getByRole('button', {name: 'Save'}));
        
        expect(screen.getByText('some error')).toBeInTheDocument();
    });

    describe('handleSave', () => {
        test('should not patch channel when header is unchanged', async () => {
            renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
            
            userEvent.click(screen.getByRole('button', {name: 'Save'}));
            
            await waitFor(() => {
                expect(baseProps.actions.patchChannel).not.toHaveBeenCalled();
            });
            expect(baseProps.onExited).toHaveBeenCalled();
        });

        test('should show error and keep modal open on failed patch', async () => {
            baseProps.actions.patchChannel.mockResolvedValueOnce({error: serverError});
            
            renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
            
            const textbox = screen.getByRole('textbox');
            userEvent.type(textbox, 'New header');
            userEvent.click(screen.getByRole('button', {name: 'Save'}));
            
            await waitFor(() => {
                expect(screen.getByText('some error')).toBeInTheDocument();
            });
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        test('should close modal on successful patch', async () => {
            renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
            
            const textbox = screen.getByRole('textbox');
            userEvent.type(textbox, 'New header');
            userEvent.click(screen.getByRole('button', {name: 'Save'}));
            
            await waitFor(() => {
                expect(baseProps.onExited).toHaveBeenCalled();
            });
        });
    });

    test('should update header text when typing', () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'New header text');
        
        expect(textbox).toHaveValue('New header text');
    });

    test('should patch channel on save button click', async () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'New channel header');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));
        
        await waitFor(() => {
            expect(baseProps.actions.patchChannel).toHaveBeenCalledWith('fake-id', {header: 'New channel header'});
        });
    });

    test('should patch channel on ctrl+enter', async () => {
        renderWithIntl(
            <EditChannelHeaderModal
                {...baseProps}
                ctrlSend={true}
            />,
        );
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'New channel header');
        userEvent.keyboard('{Control>}{Enter}{/Control}');
        
        await waitFor(() => {
            expect(baseProps.actions.patchChannel).toHaveBeenCalledWith('fake-id', {header: 'New channel header'});
        });
    });

    test('should patch channel on enter when ctrlSend is false', async () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'New channel header');
        userEvent.keyboard('{Enter}');
        
        await waitFor(() => {
            expect(baseProps.actions.patchChannel).toHaveBeenCalledWith('fake-id', {header: 'New channel header'});
        });
    });

    test('should show and clear error for invalid header length', async () => {
        renderWithIntl(<EditChannelHeaderModal {...baseProps}/>);
        
        const textbox = screen.getByRole('textbox');
        userEvent.type(textbox, 'a'.repeat(1025));
        
        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
        
        userEvent.clear(textbox);
        userEvent.type(textbox, 'valid header');
        
        expect(screen.queryByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).not.toBeInTheDocument();
    });
});
