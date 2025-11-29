// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {ChannelProfile} from './channel_profile';

describe('admin_console/team_channel_settings/channel/ChannelProfile', () => {
    test('should match snapshot', () => {
        const testTeam = TestHelper.getTeamMock({display_name: 'test'});
        const testChannel: Partial<Channel> = {display_name: 'test'};
        const {container} = renderWithContext(
            <ChannelProfile
                isArchived={false}
                team={testTeam}
                channel={testChannel}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for a shared channel', () => {
        const testTeam = TestHelper.getTeamMock({display_name: 'test'});
        const testChannel: Partial<Channel> = {
            display_name: 'test',
            type: 'O',
            shared: true,
        };
        const {container} = renderWithContext(
            <ChannelProfile
                isArchived={false}
                team={testTeam}
                channel={testChannel}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
