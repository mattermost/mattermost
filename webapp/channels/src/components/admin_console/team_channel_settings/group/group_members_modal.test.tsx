// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import GroupMembersModal from './group_members_modal';

describe('admin_console/team_channel_settings/group/GroupList', () => {
    test('should match snapshot while visible', () => {
        const group = TestHelper.getGroupMock({});

        const wrapper = shallow(
            <GroupMembersModal
                group={group}
                onExited={jest.fn()}
            />,
        );
        expect(wrapper.find('Modal').prop('show')).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });
});
