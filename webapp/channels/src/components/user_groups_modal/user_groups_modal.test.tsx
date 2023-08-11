// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {Group} from '@mattermost/types/groups';

import UserGroupsModal from './user_groups_modal';

describe('component/user_groups_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        groups: [],
        myGroups: [],
        searchTerm: '',
        currentUserId: '',
        backButtonAction: jest.fn(),
        actions: {
            getGroups: jest.fn(),
            setModalSearchTerm: jest.fn(),
            getGroupsByUserIdPaginated: jest.fn(),
            searchGroups: jest.fn(),
        },
    };

    function getGroups(numberOfGroups: number) {
        const groups: Group[] = [];
        for (let i = 0; i < numberOfGroups; i++) {
            groups.push({
                id: `group${i}`,
                name: `group${i}`,
                display_name: `Group ${i}`,
                description: `Group ${i} description`,
                source: 'custom',
                remote_id: null,
                create_at: 1637349374137,
                update_at: 1637349374137,
                delete_at: 0,
                has_syncables: false,
                member_count: i + 1,
                allow_reference: true,
                scheme_admin: false,
            });
        }

        return groups;
    }

    test('should match snapshot without groups', () => {
        const wrapper = shallow(
            <UserGroupsModal
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with groups', () => {
        const groups = getGroups(3);
        const myGroups = getGroups(1);

        const wrapper = shallow(
            <UserGroupsModal
                {...baseProps}
                groups={groups}
                myGroups={myGroups}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with groups, myGroups selected', () => {
        const groups = getGroups(3);
        const myGroups = getGroups(1);

        const wrapper = shallow(
            <UserGroupsModal
                {...baseProps}
                groups={groups}
                myGroups={myGroups}
            />,
        );

        wrapper.setState({selectedFilter: 'my'});

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with groups, search group1', () => {
        const groups = getGroups(3);
        const myGroups = getGroups(1);

        const wrapper = shallow(
            <UserGroupsModal
                {...baseProps}
                groups={groups}
                myGroups={myGroups}
                searchTerm='group1'
            />,
        );

        const instance = wrapper.instance() as UserGroupsModal;

        const e = {
            target: {
                value: '',
            },
        };
        instance.handleSearch(e as React.ChangeEvent<HTMLInputElement>);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.setModalSearchTerm).toBeCalledWith('');

        e.target.value = 'group1';
        instance.handleSearch(e as React.ChangeEvent<HTMLInputElement>);
        expect(wrapper.state('loading')).toEqual(true);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.setModalSearchTerm).toBeCalledWith(e.target.value);
    });
});
