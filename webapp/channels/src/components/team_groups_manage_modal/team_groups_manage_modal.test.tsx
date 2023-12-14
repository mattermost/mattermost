// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {shallowWithIntl, mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import TeamGroupsManageModal from './team_groups_manage_modal';

describe('components/TeamGroupsManageModal', () => {
    const getGroupsAssociatedToTeam = jest.fn().mockResolvedValue({data: true});
    const closeModal = jest.fn().mockReturnValue({data: true});
    const openModal = jest.fn().mockReturnValue({data: true});
    const unlinkGroupSyncable = jest.fn().mockReturnValue({data: true});
    const patchGroupSyncable = jest.fn().mockReturnValue({data: true});
    const getMyTeamMembers = jest.fn().mockReturnValue({data: true});

    const baseActions = {
        getGroupsAssociatedToTeam,
        closeModal,
        openModal,
        unlinkGroupSyncable,
        patchGroupSyncable,
        getMyTeamMembers,
    };

    const baseProps: ComponentProps<typeof TeamGroupsManageModal> = {
        team: TestHelper.getTeamMock({id: 'team_id'}),
        actions: baseActions,
    };

    test('should match snapshot when groups list is empty', () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);

        expect(wrapper.state('showConfirmModal')).toEqual(false);
        expect(wrapper.state('item')).toEqual({member_count: 0});
        expect(wrapper.state('listModal')).toEqual(undefined);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when groups list contains two groups', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseActions,
                getGroupsAssociatedToTeam: jest.fn().mockResolvedValue(
                    {data: {
                        groups: [
                            TestHelper.getGroupMock({display_name: 'group1'}),
                            TestHelper.getGroupMock({display_name: 'group2'}),
                        ],
                        totalGroupCount: 2,
                    }},
                ),
            },
        };
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...props}/>);

        expect(wrapper.state('showConfirmModal')).toEqual(false);
        expect(wrapper.state('item')).toEqual({member_count: 0});
        expect(wrapper.state('listModal')).toEqual(undefined);

        expect(wrapper).toMatchSnapshot();
    });

    test('should render using given component', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseActions,
                getGroupsAssociatedToTeam: jest.fn().mockResolvedValue(
                    {data: {
                        groups: [
                            TestHelper.getGroupMock({display_name: 'group1', id: 'group_id_1'}),
                            TestHelper.getGroupMock({display_name: 'group2', id: 'group_id_2'}),
                        ],
                        totalGroupCount: 2,
                    }},
                ),
            },
        };

        const wrapper = mountWithIntl(
            <TeamGroupsManageModal
                {...props}
            />,
        );

        expect(wrapper.find('.more-modal__name').exists()).toBe(true);
        expect(wrapper.find('.more-modal__name').contains('grop1')).toBe(true);
    });
});
