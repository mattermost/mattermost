// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import AddIncomingWebhook from 'components/integrations/add_incoming_webhook/add_incoming_webhook';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

const initialState = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            channels: {
                current_channel_id: TestHelper.getChannelMock({
                    id: 'current_channel_id',
                    team_id: 'current_team_id',
                    type: 'O' as ChannelType,
                    name: 'current_channel_id',
                }),
            },
            myMembers: {
                current_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'current_channel_id'}),
            },
            channelsInTeam: {
                current_team_id: new Set(['current_channel_id']),
            },
        },
        teams: {
            currentTeamId: 'current_team_id',
            teams: {
                current_team_id: TestHelper.getTeamMock({id: 'current_team_id'}),
            },
            myMembers: {
                current_team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
    },
} as DeepPartial<GlobalState>;

describe('components/integrations/AddIncomingWebhook', () => {
    const createIncomingHook = jest.fn().mockResolvedValue({data: true});
    const props = {
        team: TestHelper.getTeamMock({
            id: 'testteamid',
            name: 'test',
        }),
        enablePostUsernameOverride: true,
        enablePostIconOverride: true,
        actions: {createIncomingHook},
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<AddIncomingWebhook {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called createIncomingHook', () => {
        const hook = TestHelper.getIncomingWebhookMock({
            channel_id: 'current_channel_id',
            display_name: 'display_name',
            description: 'description',
            username: 'username',
            icon_url: 'icon_url',
            create_at: 0,
            delete_at: 0,
            update_at: 0,
            id: '',
        });
        const wrapper = renderWithContext(<AddIncomingWebhook {...props}/>, initialState as GlobalState);

        userEvent.selectOptions(wrapper.getByRole('combobox'), [hook.channel_id]);
        userEvent.type(wrapper.getByLabelText('Title'), hook.display_name);
        userEvent.type(wrapper.getByLabelText('Description'), hook.description);
        userEvent.type(wrapper.getByLabelText('Username'), hook.username);
        userEvent.type(wrapper.getByLabelText('Profile Picture'), hook.icon_url);

        userEvent.click(wrapper.getByText('Save'));

        expect(createIncomingHook).toHaveBeenCalledTimes(1);
        const calledWith = createIncomingHook.mock.calls[0][0];
        expect(calledWith).toEqual(hook);
    });
});
