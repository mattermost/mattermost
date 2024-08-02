// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Group} from '@mattermost/types/groups';

import {TestHelper} from 'utils/test_helper';

import GroupList from './group_list';

describe('admin_console/team_channel_settings/group/GroupList', () => {
    test('should match snapshot', () => {
        const testGroups: Group[] = [TestHelper.getGroupMock({
            id: '123',
            display_name: 'DN',
            member_count: 3,
        })];

        const actions = {
            getData: jest.fn().mockResolvedValue(testGroups),
        };

        const wrapper = shallow(
            <GroupList
                data={testGroups}
                groups={[]}
                onGroupRemoved={jest.fn()}
                isModeSync={false}
                totalGroups={0}
                onPageChangedCallback={jest.fn()}
                total={testGroups.length}
                actions={actions}
                removeGroup={jest.fn()}
                type='team'
                setNewGroupRole={jest.fn()}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with paging', () => {
        const testGroups: Group[] = [];
        for (let i = 0; i < 30; i++) {
            testGroups.push(TestHelper.getGroupMock({
                id: 'id' + i,
                display_name: 'DN' + i,
                member_count: 3,
            }));
        }
        const actions = {
            getData: jest.fn().mockResolvedValue(Promise.resolve(testGroups)),
        };

        const wrapper = shallow(
            <GroupList
                data={testGroups}
                groups={[]}
                onGroupRemoved={jest.fn()}
                isModeSync={false}
                totalGroups={0}
                onPageChangedCallback={jest.fn()}
                total={30}
                actions={actions}
                type='team'
                removeGroup={jest.fn()}
                setNewGroupRole={jest.fn()}
            />);

        expect(wrapper).toMatchSnapshot();
    });
});
