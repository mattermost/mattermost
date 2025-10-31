// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import {SyncableType} from '@mattermost/types/groups';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal/add_groups_to_channel_modal';
import type {AddGroupsToChannelModal as AddGroupsToChannelModalClass, Props} from 'components/add_groups_to_channel_modal/add_groups_to_channel_modal';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/AddGroupsToChannelModal', () => {
    const baseProps: Props = {
        currentChannelName: 'foo',
        currentChannelId: '123',
        teamID: '456',
        intl: {} as IntlShape,
        searchTerm: '',
        groups: [],
        onExited: jest.fn(),
        actions: {
            getGroupsNotAssociatedToChannel: jest.fn().mockResolvedValue({data: true}),
            setModalSearchTerm: jest.fn().mockResolvedValue({data: true}),
            linkGroupSyncable: jest.fn().mockResolvedValue({data: true, error: null}),
            getAllGroupsAssociatedToChannel: jest.fn().mockResolvedValue({data: true}),
            getTeam: jest.fn().mockResolvedValue({data: true}),
            getAllGroupsAssociatedToTeam: jest.fn().mockResolvedValue({data: true}),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when handleResponse is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );

        wrapper.setState({saving: true, addError: ''});
        const instance = wrapper.instance() as AddGroupsToChannelModalClass;
        instance.handleResponse();
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('addError')).toEqual(null);

        const message = 'error message';
        wrapper.setState({saving: true, addError: ''});
        instance.handleResponse({message});
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('addError')).toEqual(message);
    });

    test('should match state when handleSubmit is called', async () => {
        const linkGroupSyncable = jest.fn().mockResolvedValue({error: true, data: true});
        const actions = {...baseProps.actions, linkGroupSyncable};
        const props = {...baseProps, actions};
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...props}/>,
        );
        const instance = wrapper.instance() as AddGroupsToChannelModalClass;
        instance.handleResponse = jest.fn();
        instance.handleHide = jest.fn();
        wrapper.setState({values: []});
        await instance.handleSubmit();
        expect(actions.linkGroupSyncable).not.toHaveBeenCalled();
        expect(instance.handleResponse).not.toHaveBeenCalled();
        expect(instance.handleHide).not.toHaveBeenCalled();

        wrapper.setState({saving: false, values: [{id: 'id_1'}, {id: 'id_2'}]});
        await instance.handleSubmit();
        expect(actions.linkGroupSyncable).toHaveBeenCalled();
        expect(actions.linkGroupSyncable).toHaveBeenCalledTimes(2);
        expect(actions.linkGroupSyncable).toHaveBeenCalledWith('id_1', baseProps.currentChannelId, SyncableType.Channel, {auto_add: true});
        expect(actions.linkGroupSyncable).toHaveBeenCalledWith('id_2', baseProps.currentChannelId, SyncableType.Channel, {auto_add: true});

        expect(instance.handleResponse).toHaveBeenCalledTimes(2);
        expect(instance.handleHide).not.toHaveBeenCalled();
        expect(wrapper.state('saving')).toEqual(true);
    });

    test('should match state when addValue is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );
        const value1: any = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2: any = {id: 'id_2', label: 'label_2', value: 'value_2'};

        wrapper.setState({values: [value1]});
        const instance = wrapper.instance() as AddGroupsToChannelModalClass;
        instance.addValue(value2);
        expect(wrapper.state('values')).toEqual([value1, value2]);

        wrapper.setState({values: [value1]});
        instance.addValue(value1);
        expect(wrapper.state('values')).toEqual([value1]);
    });

    test('should match state when handlePageChange is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );

        wrapper.setState({users: [{id: 'id_1'}]});
        const instance = wrapper.instance() as AddGroupsToChannelModalClass;
        instance.handlePageChange(0, 1);
        expect(baseProps.actions.getGroupsNotAssociatedToChannel).toHaveBeenCalledTimes(1);

        instance.handlePageChange(1, 0);
        expect(baseProps.actions.getGroupsNotAssociatedToChannel).toHaveBeenCalledTimes(2);

        instance.handlePageChange(0, 1);
        expect(baseProps.actions.getGroupsNotAssociatedToChannel).toHaveBeenCalledTimes(2);
    });

    test('should match state when search is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );
        const instance = wrapper.instance() as AddGroupsToChannelModalClass;
        instance.search('');
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledWith('');

        const searchTerm = 'term';
        instance.search(searchTerm);
        expect(wrapper.state('loadingGroups')).toEqual(true);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledWith(searchTerm);
    });

    test('should match state when handleDelete is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );

        const value1 = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2 = {id: 'id_2', label: 'label_2', value: 'value_2'};
        const value3 = {id: 'id_3', label: 'label_3', value: 'value_3'};

        wrapper.setState({values: [value1]});
        const newValues: any = [value2, value3];
        (wrapper.instance() as AddGroupsToChannelModalClass).handleDelete(newValues);
        expect(wrapper.state('values')).toEqual(newValues);
    });

    test('should match when renderOption is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );

        const option: any = {id: 'id', last_picture_update: '12345', email: 'test@test.com'};
        let isSelected = false;
        function onAdd() {} //eslint-disable-line no-empty-function

        const instance = wrapper.instance() as AddGroupsToChannelModalClass;
        expect(instance.renderOption(option, isSelected, onAdd)).toMatchSnapshot();

        isSelected = true;
        expect(instance.renderOption(option, isSelected, onAdd)).toMatchSnapshot();

        const optionBot: any = {id: 'id', is_bot: true, last_picture_update: '12345'};
        expect(instance.renderOption(optionBot, isSelected, onAdd)).toMatchSnapshot();
    });

    test('should match when renderValue is called', () => {
        const wrapper = shallowWithIntl(
            <AddGroupsToChannelModal {...baseProps}/>,
        );

        expect((wrapper.instance() as AddGroupsToChannelModalClass).renderValue({data: {display_name: 'foo'}})).toEqual('foo');
    });
});
