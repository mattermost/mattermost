// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SyncableType} from '@mattermost/types/groups';

import {AddGroupsToTeamModal} from 'components/add_groups_to_team_modal/add_groups_to_team_modal';
import type {AddGroupsToTeamModal as AddGroupsToTeamModalClass} from 'components/add_groups_to_team_modal/add_groups_to_team_modal';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';

describe('components/AddGroupsToTeamModal', () => {
    const originalRAF = window.requestAnimationFrame;

    beforeEach(() => {
        window.requestAnimationFrame = jest.fn();
    });

    afterEach(() => {
        window.requestAnimationFrame = originalRAF;
    });

    const baseProps = {
        currentTeamName: 'foo',
        currentTeamId: '123',
        intl: defaultIntl,
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
        const {baseElement} = renderWithContext(
            <AddGroupsToTeamModal {...baseProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should have called onExited when handleExit is called', () => {
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );

        act(() => {
            ref.current!.handleExit();
        });
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });

    test('should match state when handleResponse is called', () => {
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
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
            instance.handleResponse(new Error(message));
        });
        expect(instance.state.saving).toEqual(false);
        expect(instance.state.addError).toEqual(message);
    });

    test('should match state when handleSubmit is called', async () => {
        const linkGroupSyncable = jest.fn().mockResolvedValue({error: true, data: true});
        const actions = {...baseProps.actions, linkGroupSyncable};
        const props = {...baseProps, actions};
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
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
        expect(actions.linkGroupSyncable).toHaveBeenCalledWith('id_1', baseProps.currentTeamId, SyncableType.Team, {auto_add: true, scheme_admin: false});
        expect(actions.linkGroupSyncable).toHaveBeenCalledWith('id_2', baseProps.currentTeamId, SyncableType.Team, {auto_add: true, scheme_admin: false});

        expect(instance.handleResponse).toHaveBeenCalledTimes(2);
        expect(instance.handleHide).not.toHaveBeenCalled();
        expect(instance.state.saving).toEqual(true);
    });

    test('should match state when addValue is called', () => {
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        const value1 = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2 = {id: 'id_2', label: 'label_2', value: 'value_2'};

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
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        act(() => {
            instance.handlePageChange(0, 1);
        });
        expect(baseProps.actions.getGroupsNotAssociatedToTeam).toHaveBeenCalledTimes(1);

        act(() => {
            instance.handlePageChange(1, 0);
        });
        expect(baseProps.actions.getGroupsNotAssociatedToTeam).toHaveBeenCalledTimes(2);

        act(() => {
            instance.handlePageChange(0, 1);
        });
        expect(baseProps.actions.getGroupsNotAssociatedToTeam).toHaveBeenCalledTimes(2);
    });

    test('should match state when search is called', () => {
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
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
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        const value1 = {id: 'id_1', label: 'label_1', value: 'value_1'};
        const value2 = {id: 'id_2', label: 'label_2', value: 'value_2'};
        const value3 = {id: 'id_3', label: 'label_3', value: 'value_3'};

        act(() => {
            instance.setState({values: [value1]});
        });
        const newValues = [value2, value3];
        act(() => {
            instance.handleDelete(newValues);
        });
        expect(instance.state.values).toEqual(newValues);
    });

    test('should match when renderOption is called', () => {
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        const option = {id: 'id_1', label: 'label_1', value: 'value_1'};
        let isSelected = false;
        const onAdd = jest.fn();
        const onMouseMove = jest.fn();

        expect(instance.renderOption(option, isSelected, onAdd, onMouseMove)).toMatchSnapshot();

        isSelected = true;
        expect(instance.renderOption(option, isSelected, onAdd, onMouseMove)).toMatchSnapshot();
    });

    test('should match when renderValue is called', () => {
        const ref = React.createRef<AddGroupsToTeamModalClass>();
        renderWithContext(
            <AddGroupsToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        expect(instance.renderValue({data: {id: 'id_1', label: 'label_1', value: 'value_1', display_name: 'foo'}})).toEqual('foo');
    });
});
