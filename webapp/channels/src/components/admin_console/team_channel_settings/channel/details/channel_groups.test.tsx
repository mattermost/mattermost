// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Group} from '@mattermost/types/groups';
import {Channel} from '@mattermost/types/channels';

import {ChannelGroups} from './channel_groups';

describe('admin_console/team_channel_settings/channel/ChannelGroups', () => {
    test('should match snapshot', () => {
        const groups: Group[] = [{
            id: '123',
            name: '',
            display_name: 'DN',
            member_count: 3,
            description: '',
            source: '',
            remote_id: null,
            create_at: -1,
            update_at: -1,
            delete_at: -1,
            has_syncables: false,
            scheme_admin: false,
            allow_reference: false,
        }];

        const testChannel: Partial<Channel> & {team_name: string} = {
            id: '123',
            team_name: 'team',
            type: 'O',
            group_constrained: false,
            name: 'DN',
        };
        const wrapper = shallow(
            <ChannelGroups
                synced={true}
                onAddCallback={jest.fn()}
                onGroupRemoved={jest.fn()}
                removedGroups={[]}
                groups={groups}
                channel={testChannel}
                totalGroups={1}
                setNewGroupRole={jest.fn()}
                isDisabled={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
