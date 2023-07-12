// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Group} from '@mattermost/types/groups';

import {TestHelper} from 'utils/test_helper';

import GroupList from './index';

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
                groups={testGroups}
                onPageChangedCallback={jest.fn()}
                totalGroups={testGroups.length}
                isModeSync={true}
                onGroupRemoved={jest.fn()}
                setNewGroupRole={jest.fn()}
                type='team'
                actions={actions}
                emptyListTextId={'test'}
                emptyListTextDefaultMessage={'test'}
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
                groups={testGroups}
                onPageChangedCallback={jest.fn()}
                totalGroups={30}
                emptyListTextId={'test'}
                emptyListTextDefaultMessage={'test'}
                actions={actions}
                type='team'
                isModeSync={false}
                onGroupRemoved={jest.fn()}
                setNewGroupRole={jest.fn()}

            />);
        expect(wrapper).toMatchSnapshot();
    });
});
