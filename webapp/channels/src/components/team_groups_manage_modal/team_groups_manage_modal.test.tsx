// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TeamGroupsManageModal from 'components/team_groups_manage_modal/team_groups_manage_modal';

import {TestHelper} from 'utils/test_helper';
import { shallowWithIntl } from 'tests/helpers/intl-test-helper';

describe('components/TeamGroupsManageModal', () => {
    const team = TestHelper.getTeamMock({ type: 'O', allowed_domains: '', allow_open_invite: false, scheme_id: undefined });
    const actions = {
        getGroupsAssociatedToTeam: jest.fn().mockResolvedValue({data: {groups: [], totalGroupCount: 0}}),
        closeModal: jest.fn(),
        openModal: jest.fn(),
        unlinkGroupSyncable: jest.fn().mockResolvedValue({data: []}),
        patchGroupSyncable: jest.fn().mockResolvedValue({data: []}),
        getMyTeamMembers: jest.fn(),
    };

    const baseProps = {
        intl: {
            formatMessage: jest.fn(),
        },
        team,
        actions
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<TeamGroupsManageModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should hide confirm modal when team changes', () => {
        const wrapper = shallow(<TeamGroupsManageModal {...baseProps}/>);
        wrapper.setProps({team: TestHelper.getTeamMock({id: 'new'})});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call getGroupsAssociatedToTeam on loadItems', async () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        await instance.loadItems(0, '');
        expect(actions.getGroupsAssociatedToTeam).toHaveBeenCalledTimes(1);
    });

    test('should call handleDeleteCanceled', () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        instance.handleDeleteCanceled();
        expect(wrapper.state('showConfirmModal')).toBe(false);
    });

    test('should call handleDeleteConfirmed', async () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        await instance.handleDeleteConfirmed();
        expect(actions.unlinkGroupSyncable).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot when onClickRemoveGroup is called', () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        instance.onClickRemoveGroup({id: 'group_id'}, {setState: jest.fn()});
        expect(wrapper).toMatchSnapshot();
    });

    test('should confirm listModal state is set correctly when onClickRemoveGroup is called', () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        const listModal = {setState: jest.fn()};
        instance.onClickRemoveGroup({id: 'group_id'}, listModal);
        expect(wrapper.state('showConfirmModal')).toBe(true);
        expect(wrapper.state('item')).toEqual({id: 'group_id'});
        expect(wrapper.state('listModal')).toEqual(listModal);
    });

    test('should open add groups modal when title button is clicked', () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        instance.titleButtonOnClick();
        expect(actions.openModal).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.openModal).toHaveBeenCalledWith({
            modalId: 'add_groups_to_team',
            dialogType: expect.anything(),
        });
    });

    test('should render group row with correct title based on scheme_admin', () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        const listModal = {setState: jest.fn()};
        const group = {id: 'group_id', display_name: 'Group', scheme_admin: true};
        const row = instance.renderRow(group, listModal);
        expect(row).toMatchSnapshot();
        group.scheme_admin = false;
        const row2 = instance.renderRow(group, listModal);
        expect(row2).toMatchSnapshot();
    });

    test('should set Team Admin status and reload items', async () => {
        const wrapper = shallowWithIntl(<TeamGroupsManageModal {...baseProps}/>);
        const instance = wrapper.instance() as any;
        const listModal = {setState: jest.fn(), props: {loadItems: jest.fn().mockResolvedValue({items: [], totalCount: 0})}, state: {page: 0, searchTerm: ''}};
        await instance.setTeamMemberStatus({id: 'group_id'}, listModal, true);
        expect(actions.patchGroupSyncable).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.patchGroupSyncable).toHaveBeenCalledWith('group_id', baseProps.team.id, 'team', {scheme_admin: true});
        expect(listModal.setState).toHaveBeenCalledWith({loading: true});
    });
});