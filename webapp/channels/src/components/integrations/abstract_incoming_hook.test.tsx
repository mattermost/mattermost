// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {DeepPartial} from '@mattermost/types/utilities';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

type AbstractIncomingWebhookProps = React.ComponentProps<typeof AbstractIncomingWebhook>;

describe('components/integrations/AbstractIncomingWebhook', () => {
    const team: Team = {id: 'team_id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        display_name: 'team_name',
        name: 'team_name',
        description: 'team_description',
        email: 'team_email',
        type: 'I',
        company_name: 'team_company_name',
        allowed_domains: 'team_allowed_domains',
        invite_id: 'team_invite_id',
        allow_open_invite: false,
        scheme_id: 'team_scheme_id',
        group_constrained: false,
    };
    const header = {id: 'header_id', defaultMessage: 'Header'};
    const footer = {id: 'footer_id', defaultMessage: 'Footer'};
    const loading = {id: 'loading_id', defaultMessage: 'Loading'};
    const serverError = '';
    const initialHook = {
        display_name: 'testIncomingWebhook',
        channel_id: 'current_channel_id',
        description: 'testing',
        id: 'test_id',
        team_id: 'team_id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        user_id: 'test_user_id',
        username: '',
        icon_url: '',
        channel_locked: false,
    };
    const enablePostUsernameOverride = true;
    const enablePostIconOverride = true;

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const requiredProps: AbstractIncomingWebhookProps = {
        team,
        header,
        footer,
        loading,
        serverError,
        initialHook,
        enablePostUsernameOverride,
        enablePostIconOverride,
        action,
        canBypassChannelLock: true,
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            channels: {
                currentChannelId: 'current_channel_id',
                channels: {
                    current_channel_id: TestHelper.getChannelMock({
                        id: 'current_channel_id',
                        team_id: 'team_id',
                        type: 'O' as ChannelType,
                        name: 'current_channel',
                        display_name: 'Current Channel',
                    }),
                },
                myMembers: {
                    current_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'current_channel_id'}),
                },
                channelsInTeam: {
                    team_id: new Set(['current_channel_id']),
                },
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id'}),
                },
                myMembers: {
                    team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
                },
            },
        },
    };

    /** Two open team channels the user belongs to; used to assert channel select updates real state. */
    const stateWithTwoTeamChannels: DeepPartial<GlobalState> = {
        ...initialState,
        entities: {
            ...initialState.entities,
            channels: {
                ...initialState.entities?.channels,
                channels: {
                    ...initialState.entities?.channels?.channels,
                    other_channel_id: TestHelper.getChannelMock({
                        id: 'other_channel_id',
                        team_id: 'team_id',
                        type: 'O' as ChannelType,
                        name: 'other_channel',
                        display_name: 'Other Channel',
                    }),
                },
                myMembers: {
                    ...initialState.entities?.channels?.myMembers,
                    other_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'other_channel_id'}),
                },
                channelsInTeam: {
                    team_id: new Set(['current_channel_id', 'other_channel_id']),
                },
            },
            teams: initialState.entities?.teams,
        },
    };

    beforeEach(() => {
        action.mockClear();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', () => {
        const newServerError = 'serverError';
        const props = {...requiredProps, serverError: newServerError};
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, displays client error when no initial hook', async () => {
        const props = {...requiredProps};
        delete props.initialHook;
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);

        await userEvent.click(screen.getByRole('button', {name: footer.defaultMessage}));

        expect(action).not.toHaveBeenCalled();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, hiding post username if not enabled', () => {
        const props = {
            ...requiredProps,
            enablePostUsernameOverride: false,
        };
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, hiding post icon url if not enabled', () => {
        const props = {
            ...requiredProps,
            enablePostIconOverride: false,
        };
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });

    test('should call action function', async () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();

        await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'name');
        await userEvent.click(screen.getByRole('button', {name: footer.defaultMessage}));

        expect(action).toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('should update state.channelId when on channel change', async () => {
        const propsWithInitialOtherChannel = {
            ...requiredProps,
            initialHook: {
                ...initialHook,
                channel_id: 'other_channel_id',
            },
        };
        renderWithContext(
            <AbstractIncomingWebhook {...propsWithInitialOtherChannel}/>,
            stateWithTwoTeamChannels as GlobalState,
        );

        const channelSelect = screen.getByRole<HTMLSelectElement>('combobox');
        expect(channelSelect.value).toBe('other_channel_id');

        await userEvent.selectOptions(channelSelect, 'current_channel_id');

        expect(channelSelect.value).toBe('current_channel_id');
    });

    test('should update state.description when on description change', async () => {
        const newDescription = 'new_description';
        renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);

        const descriptionInput = screen.getByRole('textbox', {name: 'Description'});
        await userEvent.clear(descriptionInput);
        await userEvent.type(descriptionInput, newDescription);

        expect(descriptionInput).toHaveValue(newDescription);
    });

    test('should update state.username on post username change', async () => {
        const newUsername = 'new_username';
        renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);

        const usernameInput = screen.getByRole('textbox', {name: 'Username'});
        await userEvent.clear(usernameInput);
        await userEvent.type(usernameInput, newUsername);

        expect(usernameInput).toHaveValue(newUsername);
    });

    test('should update state.iconURL on post icon url change', async () => {
        const newIconURL = 'http://example.com/icon';
        renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);

        const iconInput = screen.getByRole('textbox', {name: 'Profile Picture'});
        await userEvent.clear(iconInput);
        await userEvent.type(iconInput, newIconURL);

        expect(iconInput).toHaveValue(newIconURL);
    });

    test('should match snapshot when channelLocked is true', () => {
        const props = {...requiredProps, channelLocked: true};
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });
});
