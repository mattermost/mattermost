// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SyncableType} from '@mattermost/types/groups';

import {AddGroupsToChannelModal} from 'components/add_groups_to_channel_modal/add_groups_to_channel_modal';
import type {AddGroupsToChannelModal as AddGroupsToChannelModalClass, Props} from 'components/add_groups_to_channel_modal/add_groups_to_channel_modal';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';

describe('components/AddGroupsToChannelModal', () => {
    const originalRAF = window.requestAnimationFrame;

    beforeEach(() => {
        window.requestAnimationFrame = jest.fn();
    });

    afterEach(() => {
        window.requestAnimationFrame = originalRAF;
    });

    const baseProps: Props = {
        currentChannelName: 'foo',
        currentChannelId: '123',
        teamID: '456',
        intl: defaultIntl,
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
        const {baseElement} = renderWithContext(
            <AddGroupsToChannelModal {...baseProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match state when handleResponse is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;

        act(() => {
            instance.setState({saving: true, addError: ''});
        });
        act(() => {
            instance.handleResponse();
        });
        expect(instance.state.saving).toEqual(false);
        expect(instance.state.addError).toEqual(null);

        const message = 'error message';
        act(() => {
            instance.setState({saving: true, addError: ''});
        });
        act(() => {
            instance.handleResponse({message});
        });
        expect(instance.state.saving).toEqual(false);
        expect(instance.state.addError).toEqual(message);
    });

    test('should match state when handleSubmit is called', async () => {
        const linkGroupSyncable = jest.fn().mockResolvedValue({error: true, data: true});
        const actions = {...baseProps.actions, linkGroupSyncable};
        const props = {...baseProps, actions};
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...props}
                ref={ref}
            />,
        );
        const instance = ref.current!;
        instance.handleResponse = jest.fn();
        instance.handleHide = jest.fn();

        act(() => {
            instance.setState({values: []});
        });
        await act(async () => {
            await instance.handleSubmit();
        });
        expect(actions.linkGroupSyncable).not.toHaveBeenCalled();
        expect(instance.handleResponse).not.toHaveBeenCalled();
        expect(instance.handleHide).not.toHaveBeenCalled();

        act(() => {
            instance.setState({saving: false, values: [{id: 'id_1'} as any, {id: 'id_2'} as any]});
        });
        await act(async () => {
            await instance.handleSubmit();
        });
        expect(actions.linkGroupSyncable).toHaveBeenCalled();
        expect(actions.linkGroupSyncable).toHaveBeenCalledTimes(2);
        expect(actions.linkGroupSyncable).toHaveBeenCalledWith('id_1', baseProps.currentChannelId, SyncableType.Channel, {auto_add: true});
        expect(actions.linkGroupSyncable).toHaveBeenCalledWith('id_2', baseProps.currentChannelId, SyncableType.Channel, {auto_add: true});

        expect(instance.handleResponse).toHaveBeenCalledTimes(2);
        expect(instance.handleHide).not.toHaveBeenCalled();
        expect(instance.state.saving).toEqual(true);
    });

    test('should match state when addValue is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        const value1: any = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2: any = {id: 'id_2', label: 'label_2', value: 'value_2'};

        act(() => {
            instance.setState({values: [value1]});
        });
        act(() => {
            instance.addValue(value2);
        });
        expect(instance.state.values).toEqual([value1, value2]);

        act(() => {
            instance.setState({values: [value1]});
        });
        act(() => {
            instance.addValue(value1);
        });
        expect(instance.state.values).toEqual([value1]);
    });

    test('should match state when handlePageChange is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        act(() => {
            instance.setState({values: [{id: 'id_1'} as any]});
        });
        act(() => {
            instance.handlePageChange(0, 1);
        });
        expect(baseProps.actions.getGroupsNotAssociatedToChannel).toHaveBeenCalledTimes(1);

        act(() => {
            instance.handlePageChange(1, 0);
        });
        expect(baseProps.actions.getGroupsNotAssociatedToChannel).toHaveBeenCalledTimes(2);

        act(() => {
            instance.handlePageChange(0, 1);
        });
        expect(baseProps.actions.getGroupsNotAssociatedToChannel).toHaveBeenCalledTimes(2);
    });

    test('should match state when search is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        act(() => {
            instance.search('');
        });
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledWith('');

        const searchTerm = 'term';
        act(() => {
            instance.search(searchTerm);
        });
        expect(instance.state.loadingGroups).toEqual(true);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledWith(searchTerm);
    });

    test('should match state when handleDelete is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        const value1 = {id: 'id_1', label: 'label_1', value: 'value_1'} as any;
        const value2 = {id: 'id_2', label: 'label_2', value: 'value_2'} as any;
        const value3 = {id: 'id_3', label: 'label_3', value: 'value_3'} as any;

        act(() => {
            instance.setState({values: [value1]});
        });
        const newValues: any = [value2, value3];
        act(() => {
            instance.handleDelete(newValues);
        });
        expect(instance.state.values).toEqual(newValues);
    });

    test('should match when renderOption is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        const option: any = {id: 'id', last_picture_update: '12345', email: 'test@test.com'};
        let isSelected = false;
        function onAdd() {} //eslint-disable-line no-empty-function

        expect(instance.renderOption(option, isSelected, onAdd)).toMatchSnapshot();

        isSelected = true;
        expect(instance.renderOption(option, isSelected, onAdd)).toMatchSnapshot();

        const optionBot: any = {id: 'id', is_bot: true, last_picture_update: '12345'};
        expect(instance.renderOption(optionBot, isSelected, onAdd)).toMatchSnapshot();
    });

    test('should match when renderValue is called', () => {
        const ref = React.createRef<AddGroupsToChannelModalClass>();
        renderWithContext(
            <AddGroupsToChannelModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        expect(instance.renderValue({data: {display_name: 'foo'}})).toEqual('foo');
    });
});
