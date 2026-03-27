// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import AddOutgoingWebhook from 'components/integrations/add_outgoing_webhook/add_outgoing_webhook';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

const initialState: DeepPartial<GlobalState> = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            channels: {
                current_channel_id: TestHelper.getChannelMock({
                    id: 'current_channel_id',
                    team_id: 'testteamid',
                    type: 'O' as ChannelType,
                    name: 'current_channel',
                }),
            },
            myMembers: {
                current_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'current_channel_id'}),
            },
            channelsInTeam: {
                testteamid: new Set(['current_channel_id']),
            },
        },
        teams: {
            currentTeamId: 'testteamid',
            teams: {
                testteamid: TestHelper.getTeamMock({id: 'testteamid'}),
            },
            myMembers: {
                testteamid: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
    },
};

describe('components/integrations/AddOutgoingWebhook', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();
        const team = TestHelper.getTeamMock({
            id: 'testteamid',
            name: 'test',
        });

        const {container} = renderWithContext(
            <AddOutgoingWebhook
                team={team}
                actions={{createOutgoingHook: emptyFunction}}
                enablePostUsernameOverride={false}
                enablePostIconOverride={false}
            />,
            initialState as GlobalState,
        );
        expect(container).toMatchSnapshot();
    });
});
