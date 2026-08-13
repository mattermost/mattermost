// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {DeepPartial} from '@mattermost/types/utilities';

import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

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

describe('components/integrations/AbstractOutgoingWebhook', () => {
    const team: Team = {
        id: 'team_id',
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

    const initialHook = {
        display_name: 'testOutgoingWebhook',
        channel_id: '88cxd9wpzpbpfp8pad78xj75pr',
        creator_id: 'test_creator_id',
        description: 'testing',
        id: 'test_id',
        team_id: 'test_team_id',
        token: 'test_token',
        trigger_words: ['test', 'trigger', 'word'],
        trigger_when: 0,
        callback_urls: ['callbackUrl1.com', 'callbackUrl2.com'],
        content_type: 'test_content_type',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        user_id: 'test_user_id',
        username: '',
        icon_url: '',
        channel_locked: false,
    };

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const requiredProps = {
        team,
        header,
        footer,
        loading,
        initialHook,
        enablePostUsernameOverride: false,
        enablePostIconOverride: false,
        renderExtra: '',
        serverError: '',
        action,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });

    test('should not render username in case of enablePostUsernameOverride is false ', () => {
        const usernameTrueProps = {...requiredProps};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...usernameTrueProps}/>, initialState as GlobalState);
        expect(container.querySelector('#username')).not.toBeInTheDocument();
    });

    test('should not render post icon override in case of enablePostIconOverride is false ', () => {
        const iconUrlTrueProps = {...requiredProps};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>, initialState as GlobalState);
        expect(container.querySelector('#iconURL')).not.toBeInTheDocument();
    });

    test('should render username in case of enablePostUsernameOverride is true ', () => {
        const usernameTrueProps = {...requiredProps, enablePostUsernameOverride: true};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...usernameTrueProps}/>, initialState as GlobalState);
        expect(container.querySelector('#username')).toBeInTheDocument();
    });

    test('should render post icon override in case of enablePostIconOverride is true ', () => {
        const iconUrlTrueProps = {...requiredProps, enablePostIconOverride: true};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>, initialState as GlobalState);
        expect(container.querySelector('#iconURL')).toBeInTheDocument();
    });

    test('should update state.channelId when on channel change', async () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>, initialState as GlobalState);
        const channelSelect = container.querySelector('#channelSelect') as HTMLSelectElement;
        await userEvent.selectOptions(channelSelect, 'current_channel_id');
        expect(channelSelect).toHaveValue('current_channel_id');
    });

    test('should update state.description when on description change', async () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>, initialState as GlobalState);
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;
        await userEvent.clear(descriptionInput);
        await userEvent.type(descriptionInput, 'new_description');
        expect(descriptionInput).toHaveValue('new_description');
    });

    test('should update state.username on post username change', async () => {
        const usernameTrueProps = {...requiredProps, enablePostUsernameOverride: true};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...usernameTrueProps}/>, initialState as GlobalState);
        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        await userEvent.type(usernameInput, 'new_username');
        expect(usernameInput).toHaveValue('new_username');
    });

    test('should update state.triggerWhen on selection change', async () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>, initialState as GlobalState);
        const triggerWhenSelect = container.querySelector('#triggerWhen') as HTMLSelectElement;
        expect(triggerWhenSelect).toHaveValue('0');
        await userEvent.selectOptions(triggerWhenSelect, '1');
        expect(triggerWhenSelect).toHaveValue('1');
    });

    test('should call action function', async () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>, initialState as GlobalState);
        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        await userEvent.clear(displayNameInput);
        await userEvent.type(displayNameInput, 'name');
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        expect(action).toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1);
    });
});
