// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import {range} from 'lodash';
import React from 'react';

import GroupUsers from 'components/admin_console/group_settings/group_details/group_users';

import type {UserProfile} from '@mattermost/types/users';

describe('components/admin_console/group_settings/group_details/GroupUsers', () => {
    const members = range(0, 55).map((i) => ({
        id: 'id' + i,
        username: 'username' + i,
        first_name: 'Name' + i,
        last_name: 'Surname' + i,
        email: 'test' + i + '@test.com',
        last_picture_update: i,
    } as UserProfile));

    const defaultProps = {
        groupID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
        members: members.slice(0, 20),
        total: 20,
        getMembers: jest.fn().mockReturnValue(Promise.resolve()),
    };

    test('should match snapshot, on loading without data', () => {
        const wrapper = shallow(
            <GroupUsers
                {...defaultProps}
                members={[]}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on loading with data', () => {
        const wrapper = shallow(<GroupUsers {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded without data', () => {
        const wrapper = shallow(
            <GroupUsers
                {...defaultProps}
                members={[]}
            />,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded with data', () => {
        const wrapper = shallow(<GroupUsers {...defaultProps}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded with one page', () => {
        const wrapper = shallow(<GroupUsers {...defaultProps}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, loaded with multiple pages', () => {
        const wrapper = shallow(
            <GroupUsers
                {...defaultProps}
                members={members.slice(0, 55)}
                total={55}
            />,
        );

        // First page
        wrapper.setState({loading: false, page: 0});
        expect(wrapper).toMatchSnapshot();

        // Intermediate page
        wrapper.setState({loading: false, page: 1});
        expect(wrapper).toMatchSnapshot();

        // Last page page
        wrapper.setState({loading: false, page: 2});
        expect(wrapper).toMatchSnapshot();
    });

    test('should get the members on mount', () => {
        const getMembers = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupUsers>(
            <GroupUsers
                {...defaultProps}
                getMembers={getMembers}
            />,
        );
        wrapper.instance().componentDidMount();
        expect(getMembers).toBeCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 0, 20);
    });

    test('should change the page and not call get members on previous click', async () => {
        const wrapper = shallow<GroupUsers>(
            <GroupUsers
                {...defaultProps}
                members={members.slice(0, 55)}
                total={55}
            />,
        );
        const instance = wrapper.instance();
        wrapper.setState({page: 2});
        await instance.previousPage();
        expect(wrapper.state().page).toBe(1);
        await instance.previousPage();
        expect(wrapper.state().page).toBe(0);
        await instance.previousPage();
        expect(wrapper.state().page).toBe(0);
    });

    test('should change the page and get the members on next click', async () => {
        const getMembers = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupUsers>(
            <GroupUsers
                {...defaultProps}
                getMembers={getMembers}
                total={55}
            />,
        );
        const instance = wrapper.instance();
        getMembers.mockClear();
        wrapper.setState({page: 0});

        await instance.nextPage();
        expect(getMembers).toBeCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 1, 20);
        wrapper.setProps({members: members.slice(0, 40)});
        expect(wrapper.state().page).toBe(1);
        getMembers.mockClear();

        await instance.nextPage();
        expect(getMembers).toBeCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 2, 20);
        wrapper.setProps({members: members.slice(0, 55)});
        expect(wrapper.state().page).toBe(2);
        getMembers.mockClear();

        await instance.nextPage();
        expect(wrapper.state().page).toBe(2);
    });
});
