// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {PropertyField} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';

import useRequiredChannelAttributesToAsk from 'components/common/hooks/useRequiredChannelAttributesToAsk';
import ConvertGmToChannelModal from 'components/convert_gm_to_channel_modal/convert_gm_to_channel_modal';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import type {GlobalState} from 'types/store';

jest.mock('components/common/hooks/useRequiredChannelAttributesToAsk');
const mockUseRequiredChannelAttributesToAsk = jest.mocked(useRequiredChannelAttributesToAsk);

function attributeField(id: string, required = true): PropertyField {
    return {
        id,
        group_id: 'group1',
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: 'admin',
        attrs: {required, display_name: id, options: [{id: 'o1', name: 'Option One'}]},
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

const LOADING_TIMEOUT = 5000;

jest.setTimeout(20000);

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
                    team_id_1: {
                        id: 'team_id_1',
                        display_name: 'Team 1',
                        name: 'team_1',
                    } as Team,
                    team_id_2: {
                        id: 'team_id_2',
                        display_name: 'Team 2',
                        name: 'team_2',
                    } as Team,
                },
                currentTeamId: 'team_id_1',
            },
            general: {
                config: {
                    UseAnonymousURLs: 'false',
                },
                license: {SkuShortName: LicenseSkus.EnterpriseAdvanced},
            },
        },
    };

    beforeEach(() => {
        baseProps.actions.convertGroupMessageToPrivateChannel.mockReset();
        mockUseRequiredChannelAttributesToAsk.mockReset();
        mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [], cannotSet: [], enabled: false, loading: false});
    });

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
            {timeout: LOADING_TIMEOUT},
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
            {timeout: LOADING_TIMEOUT},
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
            {timeout: LOADING_TIMEOUT},
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
            {timeout: LOADING_TIMEOUT},
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
        await userEvent.click(team1Option!);

        const channelNameInput = screen.queryByPlaceholderText('Channel name');
        expect(channelNameInput).toBeInTheDocument();
        await userEvent.clear(channelNameInput!);
        await userEvent.type(channelNameInput!, 'Channel name set by me');

        const confirmButton = screen.queryByText('Convert to private channel');
        expect(channelNameInput).toBeInTheDocument();

        await userEvent.click(confirmButton!);
    });

    test('when UseAnonymousURLs is enabled, user cannot specify a channel URL', async () => {
        TestHelper.initBasic(Client4);
        nock(Client4.getBaseRoute()).
            get('/channels/channel_id_1/common_teams').
            reply(200, [
                {id: 'team_id_1', display_name: 'Team 1', name: 'team_1'},
            ]);

        const anonymousURLState: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities?.general,
                    config: {
                        UseAnonymousURLs: 'true',
                    },
                },
            },
        };

        renderWithContext(
            <ConvertGmToChannelModal {...baseProps}/>,
            anonymousURLState,
        );

        await waitFor(
            () =>
                expect(
                    screen.queryByText(
                        'Conversation history will be visible to any channel members',
                    ),
                ).toBeInTheDocument(),
            {timeout: LOADING_TIMEOUT},
        );

        expect(screen.queryByPlaceholderText('Channel name')).toBeVisible();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText(/URL:/)).not.toBeInTheDocument();
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
            {timeout: LOADING_TIMEOUT},
        );

        const channelNameInput = screen.queryByPlaceholderText('Channel name');
        expect(channelNameInput).toBeInTheDocument();
        await userEvent.clear(channelNameInput!);
        await userEvent.type(channelNameInput!, 'Channel');

        const confirmButton = screen.queryByText('Convert to private channel');
        expect(channelNameInput).toBeInTheDocument();

        await userEvent.click(confirmButton!);

        expect(screen.queryByText('A channel with that URL already exists')).toBeInTheDocument();
    });

    describe('required channel attributes', () => {
        const program = attributeField('program');
        const optional = attributeField('optional', false);

        const renderReady = async () => {
            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                get('/channels/channel_id_1/common_teams').
                reply(200, [{id: 'team_id_1', display_name: 'Team 1', name: 'team_1'}]);

            renderWithContext(
                <ConvertGmToChannelModal {...baseProps}/>,
                baseState,
            );

            await waitFor(
                () => expect(screen.queryByText('Conversation history will be visible to any channel members')).toBeInTheDocument(),
                {timeout: LOADING_TIMEOUT},
            );
            await userEvent.type(screen.getByPlaceholderText('Channel name'), 'Channel');
        };

        const askFor = (...fields: PropertyField[]) => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields, cannotSet: [], enabled: true, loading: false});
        };

        const pickOption = async () => {
            await userEvent.click(screen.getByRole('combobox', {name: 'program'}));
            await userEvent.click(await screen.findByRole('option', {name: 'Option One'}));
        };

        test('asks for the selected team and shows only required fields', async () => {
            askFor(program, optional);
            await renderReady();

            expect(mockUseRequiredChannelAttributesToAsk).toHaveBeenCalledWith({teamId: 'team_id_1'}, {requiredOnly: true});
            expect(screen.getByText('Channel attributes')).toBeInTheDocument();
            expect(screen.getByTestId('channelAttributeRow-program')).toBeInTheDocument();
            expect(screen.queryByTestId('channelAttributeRow-optional')).not.toBeInTheDocument();
        });

        test('does not ask for a field only its owner can write', async () => {
            const owned = {...attributeField('owned'), attrs: {...attributeField('owned').attrs, protected: true}};
            askFor(program, owned);
            await renderReady();

            expect(screen.getByTestId('channelAttributeRow-program')).toBeInTheDocument();
            expect(screen.queryByTestId('channelAttributeRow-owned')).not.toBeInTheDocument();
        });

        test('keeps the button disabled until the field is set, then sends the values', async () => {
            askFor(program);
            baseProps.actions.convertGroupMessageToPrivateChannel.mockResolvedValueOnce({});
            await renderReady();

            const confirmButton = screen.getByRole('button', {name: 'Convert to private channel'});
            expect(confirmButton).toBeDisabled();

            await pickOption();
            expect(confirmButton).toBeEnabled();

            await userEvent.click(confirmButton);

            expect(baseProps.actions.convertGroupMessageToPrivateChannel).toHaveBeenCalledWith(
                'channel_id_1',
                'team_id_1',
                'Channel',
                'channel',
                [{field_id: 'program', value: 'o1'}],
            );
        });

        test('shows a server error and keeps the modal open', async () => {
            askFor(program);
            baseProps.actions.convertGroupMessageToPrivateChannel.mockResolvedValueOnce({
                error: {message: 'Missing required channel attribute: program'},
            });
            await renderReady();

            await pickOption();
            await userEvent.click(screen.getByRole('button', {name: 'Convert to private channel'}));

            expect(await screen.findByText('Missing required channel attribute: program')).toBeInTheDocument();
            expect(baseProps.onExited).not.toHaveBeenCalled();
            expect(screen.getByRole('button', {name: 'Convert to private channel'})).toBeEnabled();
        });

        test('never disables the button while attributes are not enabled, even if reported loading', async () => {
            mockUseRequiredChannelAttributesToAsk.mockReturnValue({fields: [], cannotSet: [], enabled: false, loading: true});
            await renderReady();

            expect(screen.getByRole('button', {name: 'Convert to private channel'})).toBeEnabled();
        });

        test('flag off leaves the dialog and payload unchanged', async () => {
            baseProps.actions.convertGroupMessageToPrivateChannel.mockResolvedValueOnce({});
            await renderReady();

            expect(screen.queryByText('Channel attributes')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Convert to private channel'}));

            expect(baseProps.actions.convertGroupMessageToPrivateChannel.mock.calls[0]).toEqual([
                'channel_id_1',
                'team_id_1',
                'Channel',
                'channel',
            ]);
        });
    });
});
