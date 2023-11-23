// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, waitFor} from '@testing-library/react';
import nock from 'nock';
import React from 'react';
import {act} from 'react-dom/test-utils';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';

import ConvertGmToChannelModal from 'components/convert_gm_to_channel_modal/convert_gm_to_channel_modal';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

describe('component/ConvertGmToChannelModal', () => {
    const user1 = TestHelper.fakeUserWithId();
    const user2 = TestHelper.fakeUserWithId();
    const user3 = TestHelper.fakeUserWithId();

    const baseProps = {
        onExited: jest.fn(),
        channel: {id: 'channel_id_1', type: 'G'} as Channel,
        actions: {
            closeModal: jest.fn(),
            convertGroupMessageToPrivateChannel: jest.fn(),
            moveChannelsInSidebar: jest.fn(),
        },
        profilesInChannel: [user1, user2, user3] as UserProfile[],
        teammateNameDisplaySetting: Preferences.DISPLAY_PREFER_FULL_NAME,
        channelsCategoryId: 'sidebar_category_1',
        currentUserId: user1.id,
    };

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            teams: {
                teams: {
                    team_id_1: {id: 'team_id_1', display_name: 'Team 1', name: 'team_1'} as Team,
                    team_id_2: {id: 'team_id_2', display_name: 'Team 2', name: 'team_2'} as Team,
                },
                currentTeamId: 'team_id_1',
            },
        },
    };

    test('members part of multiple common teams', async () => {
        TestHelper.initBasic(Client4);
        nock(Client4.getBaseRoute()).
            get('/channels/channel_id_1/common_teams').
            reply(200, [
                {id: 'team_id_1', display_name: 'Team 1', name: 'team_1'},
                {id: 'team_id_2', display_name: 'Team 2', name: 'team_2'},
            ]);

        renderWithContext(
            <ConvertGmToChannelModal {...baseProps}/>,
            baseState,
        );

        // we need to use waitFor for first assertion as we have a minimum 1200 ms loading animation in the dialog
        // before it's content is rendered.
        await waitFor(
            () => expect(screen.queryByText('Conversation history will be visible to any channel members')).toBeInTheDocument(),
            {timeout: 1500},
        );

        expect(screen.queryByText('Select Team')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Channel name')).toBeInTheDocument();
        expect(screen.queryByText('Edit')).toBeInTheDocument();
        expect(screen.queryByText('URL: http://localhost:8065/team_1/channels/')).toBeInTheDocument();
    });

    test('members part of single common teams', async () => {
        TestHelper.initBasic(Client4);
        nock(Client4.getBaseRoute()).
            get('/channels/channel_id_1/common_teams').
            reply(200, [
                {id: 'team_id_1', display_name: 'Team 1', name: 'team_1'},
            ]);

        renderWithContext(
            <ConvertGmToChannelModal {...baseProps}/>,
            baseState,
        );

        // we need to use waitFor for first assertion as we have a minimum 1200 ms loading animation in the dialog
        // before it's content is rendered.
        await waitFor(
            () => expect(screen.queryByText('Conversation history will be visible to any channel members')).toBeInTheDocument(),
            {timeout: 1500},
        );

        expect(screen.queryByText('Select Team')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Channel name')).toBeInTheDocument();
        expect(screen.queryByText('Edit')).toBeInTheDocument();
    });

    test('members part of no common teams', async () => {
        TestHelper.initBasic(Client4);
        nock(Client4.getBaseRoute()).
            get('/channels/channel_id_1/common_teams').
            reply(200, []);

        renderWithContext(
            <ConvertGmToChannelModal {...baseProps}/>,
            baseState,
        );

        // we need to use waitFor for first assertion as we have a minimum 1200 ms loading animation in the dialog
        // before it's content is rendered.
        await waitFor(
            () => expect(screen.queryByText('Unable to convert to a channel because group members are part of different teams')).toBeInTheDocument(),
            {timeout: 1500},
        );

        expect(screen.queryByText('Select Team')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Channel name')).not.toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    test('multiple common teams - trying conversion', async () => {
        TestHelper.initBasic(Client4);
        nock(Client4.getBaseRoute()).
            get('/channels/channel_id_1/common_teams').
            reply(200, [
                {id: 'team_id_1', display_name: 'Team 1', name: 'team_1'},
                {id: 'team_id_2', display_name: 'Team 2', name: 'team_2'},
            ]);

        baseProps.actions.convertGroupMessageToPrivateChannel.mockResolvedValueOnce({});

        renderWithContext(
            <ConvertGmToChannelModal {...baseProps}/>,
            baseState,
        );

        // we need to use waitFor for first assertion as we have a minimum 1200 ms loading animation in the dialog
        // before it's content is rendered.
        await waitFor(
            () => expect(screen.queryByText('Conversation history will be visible to any channel members')).toBeInTheDocument(),
            {timeout: 1500},
        );

        const teamDropdown = screen.queryByText('Select Team');
        expect(teamDropdown).not.toBeNull();
        fireEvent(
            teamDropdown!,
            new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
            }),
        );

        const team1Option = screen.queryByText('Team 1');
        expect(team1Option).toBeInTheDocument();
        fireEvent.click(team1Option!);

        const channelNameInput = screen.queryByPlaceholderText('Channel name');
        expect(channelNameInput).toBeInTheDocument();
        fireEvent.change(channelNameInput!, {target: {value: 'Channel name set by me'}});

        const confirmButton = screen.queryByText('Convert to private channel');
        expect(channelNameInput).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(confirmButton!);
        });
    });

    test('duplicate channel names should npt be allowed', async () => {
        TestHelper.initBasic(Client4);

        nock(Client4.getBaseRoute()).
            get('/channels/channel_id_1/common_teams').
            reply(200, [
                {id: 'team_id_1', display_name: 'Team 1', name: 'team_1'},
            ]);

        baseProps.actions.convertGroupMessageToPrivateChannel.mockResolvedValueOnce({
            error: {
                server_error_id: 'store.sql_channel.save_channel.exists.app_error',
            },
        });

        renderWithContext(
            <ConvertGmToChannelModal {...baseProps}/>,
            baseState,
        );

        await waitFor(
            () => expect(screen.queryByText('Conversation history will be visible to any channel members')).toBeInTheDocument(),
            {timeout: 1500},
        );

        const channelNameInput = screen.queryByPlaceholderText('Channel name');
        expect(channelNameInput).toBeInTheDocument();
        fireEvent.change(channelNameInput!, {target: {value: 'Channel'}});

        const confirmButton = screen.queryByText('Convert to private channel');
        expect(channelNameInput).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(confirmButton!);
        });

        expect(screen.queryByText('A channel with that URL already exists')).toBeInTheDocument();
    });
});
