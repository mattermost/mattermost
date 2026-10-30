// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import RenameChannelModal from './rename_channel_modal';

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn().mockReturnValue({push: jest.fn()}),
}));

const state = {
    entities: {
        general: {
            config: {},
            license: {},
        },
        teams: {
            currentTeamId: 'team-id',
            teams: {
                'team-id': TestHelper.getTeamMock({id: 'team-id', name: 'test-team'}),
            },
        },
    },
};

const ordinaryChannel = TestHelper.getChannelMock({
    id: 'channel-id',
    team_id: 'team-id',
    display_name: 'Test Channel',
    name: 'test-channel',
    type: 'O',
});

const defaultChannel = TestHelper.getChannelMock({
    id: 'town-square-id',
    team_id: 'team-id',
    display_name: 'Town Square',
    name: 'town-square',
    type: 'O',
});

const makeProps = (channel = ordinaryChannel, patched = channel) => ({
    channel,
    teamName: 'test-team',
    onExited: jest.fn(),
    actions: {
        patchChannel: jest.fn().mockResolvedValue({data: patched}),
    },
});

describe('RenameChannelModal', () => {
    test('should not offer the URL Edit button for the default channel', () => {
        renderWithContext(<RenameChannelModal {...makeProps(defaultChannel)}/>, state);

        expect(screen.getByTestId('urlInputLabel')).toHaveTextContent('town-square');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
        expect(screen.getByText('The URL of the default channel cannot be changed.')).toBeVisible();
    });

    test('should save the default channel display name without changing its URL', async () => {
        const props = makeProps(defaultChannel);

        renderWithContext(<RenameChannelModal {...props}/>, state);

        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Company Wide');

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // The server rejects the patch only when `name` differs from the
        // default channel's current name, so it must be sent unchanged.
        await waitFor(() => {
            expect(props.actions.patchChannel).toHaveBeenCalledWith('town-square-id', {
                display_name: 'Company Wide',
                name: 'town-square',
            });
        });
        expect(getHistory().push).toHaveBeenCalledWith('/test-team/channels/town-square');
    });

    test('should let the user rename the URL of an ordinary channel', async () => {
        const props = makeProps(ordinaryChannel, {...ordinaryChannel, name: 'renamed-channel'});

        renderWithContext(<RenameChannelModal {...props}/>, state);

        expect(screen.queryByText('The URL of the default channel cannot be changed.')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        const urlInput = screen.getByTestId('channelURLInput');
        await userEvent.clear(urlInput);
        await userEvent.type(urlInput, 'renamed-channel');

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(props.actions.patchChannel).toHaveBeenCalledWith('channel-id', {
                display_name: 'Test Channel',
                name: 'renamed-channel',
            });
        });
        expect(getHistory().push).toHaveBeenCalledWith('/test-team/channels/renamed-channel');
    });
});
