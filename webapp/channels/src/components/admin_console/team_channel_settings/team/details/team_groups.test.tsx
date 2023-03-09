// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import {TeamGroups} from './team_groups';

describe('admin_console/team_channel_settings/team/TeamGroups', () => {
    test('should match snapshot', () => {
        const groups = [TestHelper.getGroupMock({
            id: '123',
            display_name: 'DN',
            member_count: 3,
        })];

        const testTeam = TestHelper.getTeamMock({
            id: '123',
            allow_open_invite: false,
            allowed_domains: '',
            group_constrained: false,
            display_name: 'team',
        });
        const wrapper = shallow(
            <TeamGroups
                syncChecked={true}
                onAddCallback={jest.fn()}
                onGroupRemoved={jest.fn()}
                setNewGroupRole={jest.fn()}
                removedGroups={[]}
                groups={groups}
                team={testTeam}
                totalGroups={1}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
