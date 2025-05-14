// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {ClientConfig} from '@mattermost/types/config';
import type {Team} from '@mattermost/types/teams';

import * as teams from 'mattermost-redux/selectors/entities/teams';

import * as channelActions from 'actions/views/channel';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsArchiveTab from './channel_settings_archive_tab';

// Mock the redux actions and selectors
jest.mock('actions/views/channel', () => ({
    deleteChannel: jest.fn().mockReturnValue({type: 'MOCK_DELETE_ACTION'}),
}));

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general') as typeof import('mattermost-redux/selectors/entities/general'),
    getConfig: () => mockConfig,
}));

// Mock the roles selector which is a dependency for other selectors
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveITeamPermission: jest.fn().mockReturnValue(true),
    haveIChannelPermission: jest.fn().mockReturnValue(true),
    getRoles: jest.fn().mockReturnValue({}),
}));

// Create a mock channel for testing
const mockChannel = TestHelper.getChannelMock({
    id: 'using-26-letter-channel-id', // so channel id validation length works
    team_id: 'team1',
    display_name: 'Test Channel',
    name: 'test-channel',
    type: 'O',
});

const baseProps = {
    channel: mockChannel,
    onHide: jest.fn(),
};

let mockConfig: Partial<ClientConfig>;

describe('ChannelSettingsArchiveTab', () => {
    const {getHistory} = require('utils/browser_history');
    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = {
            ExperimentalViewArchivedChannels: 'false',
        };

        jest.spyOn(teams, 'getCurrentTeam').mockReturnValue({
            id: 'team1',
            name: 'team-name',
        } as Team);

        const historyPush = jest.fn();
        (getHistory as jest.Mock).mockReturnValue({push: historyPush});
    });

    it('should render the archive button', () => {
        renderWithContext(<ChannelSettingsArchiveTab {...baseProps}/>);

        // Check that the archive button is rendered
        const archiveButton = screen.getByText('Archive this channel');
        expect(archiveButton).toBeInTheDocument();
        expect(archiveButton).toHaveAttribute('aria-label', 'Archive channel Test Channel');
    });

    it('should show confirmation modal when archive button is clicked', async () => {
        renderWithContext(<ChannelSettingsArchiveTab {...baseProps}/>);

        // Click the archive button
        await userEvent.click(screen.getByText('Archive this channel'));

        // Check that the confirmation modal is shown
        expect(screen.getByTestId('archiveChannelConfirmModal')).toBeInTheDocument();
        expect(screen.getByText('Archive channel?')).toBeInTheDocument();
    });

    it('should call deleteChannel and onHide when confirmed', async () => {
        const onHide = jest.fn();

        renderWithContext(<ChannelSettingsArchiveTab {...{...baseProps, onHide}}/>);

        // Click the archive button
        await userEvent.click(screen.getByText('Archive this channel'));

        // Click the confirm button in the modal
        await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

        // Check that deleteChannel was called with the channel ID
        expect(channelActions.deleteChannel).toHaveBeenCalledWith(mockChannel.id);

        // Check that onHide was called
        expect(onHide).toHaveBeenCalled();
    });

    it('should close the confirmation modal when canceled', async () => {
        renderWithContext(<ChannelSettingsArchiveTab {...baseProps}/>);

        // Click the archive button
        await userEvent.click(screen.getByText('Archive this channel'));

        // Check that the confirmation modal is shown
        expect(screen.getByTestId('archiveChannelConfirmModal')).toBeInTheDocument();

        // Click the cancel button in the modal
        await userEvent.click(screen.getByTestId('cancel-button'));

        // Check that the confirmation modal is hidden
        await waitFor(() => {
            expect(screen.queryByTestId('archiveChannelConfirmModal')).not.toBeInTheDocument();
        });
    });

    it('should call deleteChannel which handles redirection when archived channel cannot be viewed', async () => {
        // Mock the deleteChannel implementation to simulate the action's behavior
        const {deleteChannel} = require('actions/views/channel');
        deleteChannel.mockImplementationOnce(() => {
            return () => {
                // The action would handle redirection internally
                return {data: true};
            };
        });

        renderWithContext(<ChannelSettingsArchiveTab {...baseProps}/>);

        // Click the archive button
        await userEvent.click(screen.getByText('Archive this channel'));

        // Check that the confirmation modal is shown
        expect(screen.getByTestId('archiveChannelConfirmModal')).toBeInTheDocument();

        // Click the confirm button in the modal
        await userEvent.click(screen.getByText('Confirm'));

        // Check that deleteChannel was called with the channel ID
        expect(channelActions.deleteChannel).toHaveBeenCalledWith(mockChannel.id);
    });

    it('should show correct message when archived channels cannot be viewed', async () => {
        renderWithContext(<ChannelSettingsArchiveTab {...baseProps}/>);

        // Click the archive button
        await userEvent.click(screen.getByText('Archive this channel'));

        // Check that the confirmation modal message mentions that archived channels cannot be viewed
        const modalMessage = screen.getByTestId('archiveChannelConfirmModal');
        expect(modalMessage).toBeInTheDocument();

        // Check for the specific text content within the modal
        // Use the within function to scope the query to just the modal content
        const modalBody = screen.getByTestId('archiveChannelConfirmModal').querySelector('#confirmModalBody');
        expect(modalBody).toBeInTheDocument();
        expect(modalBody).toHaveTextContent(/Archiving a channel removes it from the user interface/);
    });

    it('should call deleteChannel which handles channel ID validation', async () => {
        // Create a channel with an invalid ID
        const invalidChannel = {
            ...mockChannel,
            id: 'invalid', // Too short to be a valid channel ID
        };

        // Mock the deleteChannel implementation to simulate the action's behavior
        const {deleteChannel} = require('actions/views/channel');
        deleteChannel.mockImplementationOnce(() => {
            return () => {
                // The action would handle validation internally and return false for invalid IDs
                return {data: false};
            };
        });

        renderWithContext(<ChannelSettingsArchiveTab {...{...baseProps, channel: invalidChannel}}/>);

        // Click the archive button
        await userEvent.click(screen.getByText('Archive this channel'));

        // Click the confirm button in the modal
        await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

        // Check that deleteChannel was called with the invalid channel ID
        expect(channelActions.deleteChannel).toHaveBeenCalledWith(invalidChannel.id);
    });
});
