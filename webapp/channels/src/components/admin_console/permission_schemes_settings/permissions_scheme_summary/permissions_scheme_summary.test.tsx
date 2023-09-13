// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PermissionsSchemeSummary from 'components/admin_console/permission_schemes_settings/permissions_scheme_summary/permissions_scheme_summary';
import ConfirmModal from 'components/confirm_modal';

describe('components/admin_console/permission_schemes_settings/permissions_scheme_summary', () => {
    const defaultProps = {
        scheme: {
            id: 'id',
            name: 'xxxxxxxxxx',
            display_name: 'Test',
            description: 'Test description',
        },
        teams: [
            {id: 'xxx', name: 'team-1', display_name: 'Team 1'},
            {id: 'yyy', name: 'team-2', display_name: 'Team 2'},
            {id: 'zzz', name: 'team-3', display_name: 'Team 3'},
        ],
        actions: {
            deleteScheme: jest.fn().mockResolvedValue({data: true}),
        },
    } as any;

    test('should match snapshot on default data', () => {
        const wrapper = shallow(
            <PermissionsSchemeSummary {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on more than eight teams', () => {
        const wrapper = shallow(
            <PermissionsSchemeSummary
                {...defaultProps}
                teams={[
                    {id: 'aaa', name: 'team-1', display_name: 'Team 1'},
                    {id: 'bbb', name: 'team-2', display_name: 'Team 2'},
                    {id: 'ccc', name: 'team-3', display_name: 'Team 3'},
                    {id: 'ddd', name: 'team-4', display_name: 'Team 4'},
                    {id: 'eee', name: 'team-5', display_name: 'Team 5'},
                    {id: 'fff', name: 'team-6', display_name: 'Team 6'},
                    {id: 'ggg', name: 'team-7', display_name: 'Team 7'},
                    {id: 'hhh', name: 'team-8', display_name: 'Team 8'},
                    {id: 'iii', name: 'team-9', display_name: 'Team 9'},
                    {id: 'jjj', name: 'team-9', display_name: 'Team 10'},
                ]}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on no teams', () => {
        const wrapper = shallow(
            <PermissionsSchemeSummary
                {...defaultProps}
                teams={[]}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should ask to toggle on row toggle', () => {
        const deleteScheme = jest.fn().mockResolvedValue({data: true});
        const wrapper = shallow(
            <PermissionsSchemeSummary
                {...defaultProps}
                actions={{
                    deleteScheme,
                }}
            />,
        );
        expect(deleteScheme).not.toBeCalled();
        wrapper.find('.delete-button').first().simulate('click', {stopPropagation: jest.fn()});
        expect(deleteScheme).not.toBeCalled();
        wrapper.find(ConfirmModal).first().props().onCancel?.(true);
        expect(deleteScheme).not.toBeCalled();

        wrapper.find('.delete-button').first().simulate('click', {stopPropagation: jest.fn()});
        wrapper.find(ConfirmModal).first().props().onConfirm?.(true);
        expect(deleteScheme).toBeCalledWith('id');
    });
});
