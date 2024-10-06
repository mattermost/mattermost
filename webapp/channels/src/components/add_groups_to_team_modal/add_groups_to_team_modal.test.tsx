// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SyncableType} from '@mattermost/types/groups';

import AddGroupsToTeamModal from 'components/add_groups_to_team_modal/add_groups_to_team_modal';
import type {AddGroupsToTeamModal as AddGroupsToTeamModalClass} from 'components/add_groups_to_team_modal/add_groups_to_team_modal';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/AddGroupsToTeamModal', () => {
    const baseProps = {
        currentTeamName: 'foo',
        currentTeamId: '123',
        searchTerm: '',
        groups: [],
        onExited: jest.fn(),
        actions: {
            getGroupsNotAssociatedToTeam: jest.fn().mockResolvedValue({data: true}),
            setModalSearchTerm: jest.fn().mockResolvedValue({data: true}),
            linkGroupSyncable: jest.fn().mockResolvedValue({data: true, error: null}),
            getAllGroupsAssociatedToTeam: jest.fn().mockResolvedValue({data: true}),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called onExited when handleExit is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );

        (wrapper.instance() as AddGroupsToTeamModalClass).handleExit();
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });

    test('should match state when handleResponse is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );

        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        wrapper.setState({saving: true, addError: ''});
        instance.handleResponse();
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('addError')).toEqual(null);

        const message = 'error message';
        wrapper.setState({saving: true, addError: ''});
        instance.handleResponse(new Error(message));
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('addError')).toEqual(message);
    });

    test('should match state when handleSubmit is called', async () => {
        const linkGroupSyncable = jest.fn().mockResolvedValue({error: true, data: true});
        const actions = {...baseProps.actions, linkGroupSyncable};
        const props = {...baseProps, actions};
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...props}/>,
        );
        const instance = wrapper.instance() as AddGroupsToTeamModalClass;
        instance.handleResponse = jest.fn();
        instance.handleHide = jest.fn();

        wrapper.setState({values: []});
        await instance.handleSubmit();
        expect(actions.linkGroupSyncable).not.toBeCalled();
        expect(instance.handleResponse).not.toBeCalled();
        expect(instance.handleHide).not.toBeCalled();

        wrapper.setState({saving: false, values: [{id: 'id_1'}, {id: 'id_2'}]});
        await instance.handleSubmit();
        expect(actions.linkGroupSyncable).toBeCalled();
        expect(actions.linkGroupSyncable).toHaveBeenCalledTimes(2);
        expect(actions.linkGroupSyncable).toBeCalledWith('id_1', baseProps.currentTeamId, SyncableType.Team, {auto_add: true, scheme_admin: false});
        expect(actions.linkGroupSyncable).toBeCalledWith('id_2', baseProps.currentTeamId, SyncableType.Team, {auto_add: true, scheme_admin: false});

        expect(instance.handleResponse).toBeCalledTimes(2);
        expect(instance.handleHide).not.toBeCalled();
        expect(wrapper.state('saving')).toEqual(true);
    });

    test('should match state when addValue is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );

        const value1 = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2 = {id: 'id_2', label: 'label_2', value: 'value_2'};

        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        wrapper.setState({values: [value1]});
        instance.addValue(value2);
        expect(wrapper.state('values')).toEqual([value1, value2]);

        wrapper.setState({values: [value1]});
        instance.addValue(value1);
        expect(wrapper.state('values')).toEqual([value1]);
    });

    test('should match state when handlePageChange is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );

        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        instance.handlePageChange(0, 1);
        expect(baseProps.actions.getGroupsNotAssociatedToTeam).toHaveBeenCalledTimes(1);

        instance.handlePageChange(1, 0);
        expect(baseProps.actions.getGroupsNotAssociatedToTeam).toHaveBeenCalledTimes(2);

        instance.handlePageChange(0, 1);
        expect(baseProps.actions.getGroupsNotAssociatedToTeam).toHaveBeenCalledTimes(2);
    });

    test('should match state when search is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );
        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        instance.search('');
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.setModalSearchTerm).toBeCalledWith('');

        const searchTerm = 'term';
        instance.search(searchTerm);
        expect(wrapper.state('loadingGroups')).toEqual(true);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.setModalSearchTerm).toBeCalledWith(searchTerm);
    });

    test('should match state when handleDelete is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );
        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        const value1 = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2 = {id: 'id_2', label: 'label_2', value: 'value_2'};
        const value3 = {id: 'id_3', label: 'label_3', value: 'value_3'};

        wrapper.setState({values: [value1]});
        const newValues = [value2, value3];
        instance.handleDelete(newValues);
        expect(wrapper.state('values')).toEqual(newValues);
    });

    test('should match when renderOption is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );
        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        const option = {id: 'id_1', label: 'label_1', value: 'value_1'};
        let isSelected = false;
        const onAdd = jest.fn();
        const onMouseMove = jest.fn();

        expect(instance.renderOption(option, isSelected, onAdd, onMouseMove)).toMatchSnapshot();

        isSelected = true;
        expect(instance.renderOption(option, isSelected, onAdd, onMouseMove)).toMatchSnapshot();
    });

    test('should match when renderValue is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToTeamModal {...baseProps}/>,
        );
        const instance = wrapper.instance() as AddGroupsToTeamModalClass;

        expect(instance.renderValue({data: {id: 'id_1', label: 'label_1', value: 'value_1', display_name: 'foo'}})).toEqual('foo');
    });
});
