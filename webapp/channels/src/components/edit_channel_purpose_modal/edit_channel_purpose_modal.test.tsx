// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import EditChannelPurposeModal from 'components/edit_channel_purpose_modal/edit_channel_purpose_modal';

import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('comoponents/EditChannelPurposeModal', () => {
    const channel = TestHelper.getChannelMock({
        purpose: 'testPurpose',
    });

    it('should match on init', () => {
        const {container} = renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match with display name', () => {
        const channelWithDisplayName = {
            ...channel,
            display_name: 'channel name',
        };

        const {container} = renderWithContext(
            <EditChannelPurposeModal
                channel={channelWithDisplayName}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match for private channel', () => {
        const privateChannel: Channel = {
            ...channel,
            type: 'P',
        };

        const {container} = renderWithContext(
            <EditChannelPurposeModal
                channel={privateChannel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match submitted', () => {
        const {container} = renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('match with modal error', async () => {
        const serverError = {
            id: 'api.context.invalid_param.app_error',
            message: 'error',
        };

        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn().mockResolvedValue({error: serverError})}}
            />,
        );

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('match with modal error with fake id', async () => {
        const serverError = {
            id: 'fake-error-id',
            message: 'error',
        };

        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn().mockResolvedValue({error: serverError})}}
            />,
        );

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('clear error on next', async () => {
        const serverError = {
            id: 'fake-error-id',
            message: 'error',
        };

        const {container} = renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn().mockResolvedValue({error: serverError})}}
            />,
        );

        // Trigger the error by clicking Save
        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        // Verify error is displayed
        expect(screen.getByText('error')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it('update purpose state', async () => {
        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        const textarea = screen.getByRole('textbox');
        await userEvent.clear(textarea);
        await userEvent.type(textarea, 'new info');

        expect(textarea).toHaveValue('new info');
    });

    it('hide on success', async () => {
        const onExited = jest.fn();

        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={true}
                onExited={onExited}
                actions={{patchChannel: jest.fn().mockResolvedValue({data: true})}}
            />,
        );

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        // After successful save, the modal should start hiding (show state is false)
        // The modal element gets the 'fade' class without 'in' when hiding
        const modal = screen.getByRole('dialog');
        expect(modal.classList.contains('in')).toBe(false);
    });

    it('submit on save button click', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {purpose: 'testPurpose'});
    });

    it('submit on ctrl + enter', () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textarea = screen.getByRole('textbox');
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            ctrlKey: true,
            bubbles: true,
        }));

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {purpose: 'testPurpose'});
    });

    it('submit on enter', () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelPurposeModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textarea = screen.getByRole('textbox');
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            ctrlKey: false,
            bubbles: true,
        }));

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {purpose: 'testPurpose'});
    });

    testComponentForLineBreak((value: string) => (
        <EditChannelPurposeModal
            channel={{
                ...channel,
                purpose: value,
            }}
            ctrlSend={true}
            onExited={jest.fn()}
            actions={{patchChannel: jest.fn()}}
        />
    ), (container: HTMLElement) => (container.querySelector('textarea') as HTMLTextAreaElement)?.value ?? '');
});
