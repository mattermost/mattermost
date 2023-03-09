// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import GroupsList from 'components/admin_console/group_settings/groups_list/groups_list';

describe('components/admin_console/group_settings/GroupsList.tsx', () => {
    test('should match snapshot, while loading', () => {
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({loading: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with only linked selected', () => {
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({checked: {test2: true}});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with only not-linked selected', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({checked: {test1: true}});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with mixed types selected', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({checked: {test1: true, test2: true}});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without selection', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({checked: {}});
        expect(wrapper).toMatchSnapshot();
    });

    test('onCheckToggle must toggle the checked data', () => {
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        const instance = wrapper.instance();
        expect(wrapper.state().checked).toEqual({});
        instance.onCheckToggle('test1');
        expect(wrapper.state().checked).toEqual({test1: true});
        instance.onCheckToggle('test1');
        expect(wrapper.state().checked).toEqual({test1: false});
        instance.onCheckToggle('test2');
        expect(wrapper.state().checked).toEqual({test1: false, test2: true});
        instance.onCheckToggle('test2');
        expect(wrapper.state().checked).toEqual({test1: false, test2: false});
    });

    test('linkSelectedGroups must call link for unlinked selected groups', () => {
        const link = jest.fn();
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link,
                    unlink: jest.fn(),
                }}
            />,
        );
        const instance = wrapper.instance();
        expect(wrapper.state().checked).toEqual({});
        instance.onCheckToggle('test1');
        instance.onCheckToggle('test2');
        instance.linkSelectedGroups();
        expect(link).toHaveBeenCalledTimes(1);
        expect(link).toHaveBeenCalledWith('test1');
    });

    test('unlinkSelectedGroups must call unlink for linked selected groups', () => {
        const unlink = jest.fn();
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test4', name: 'test4'},
                ]}
                total={4}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink,
                }}
            />,
        );
        const instance = wrapper.instance();
        expect(wrapper.state().checked).toEqual({});
        instance.onCheckToggle('test1');
        instance.onCheckToggle('test2');
        instance.unlinkSelectedGroups();
        expect(unlink).toHaveBeenCalledTimes(1);
        expect(unlink).toHaveBeenCalledWith('test2');
    });

    test('should match snapshot, without results', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with results', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={3}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with results and next and previous', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={33}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({page: 1, loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with results and next', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={13}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with results and previous', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={13}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({page: 1, loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should change properly the state and call the getLdapGroups, on previousPage when page > 0', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={20}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({page: 2, checked: {test1: true, test2: true}});

        await wrapper.instance().previousPage({preventDefault: jest.fn()});

        let state = wrapper.instance().state;
        expect(state.checked).toEqual({});
        expect(state.page).toBe(1);
        expect(state.loading).toBe(false);

        await wrapper.instance().previousPage({preventDefault: jest.fn()});
        state = wrapper.state();
        expect(state.checked).toEqual({});
        expect(state.page).toBe(0);
        expect(state.loading).toBe(false);
    });

    test('should change properly the state and call the getLdapGroups, on previousPage when page == 0', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={3}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({page: 0, checked: {test1: true, test2: true}});

        await wrapper.instance().previousPage({preventDefault: jest.fn()});

        const state = wrapper.instance().state;
        expect(state.checked).toEqual({});
        expect(state.page).toBe(0);
        expect(state.loading).toBe(false);
    });

    test('should change properly the state and call the getLdapGroups, on nextPage clicked', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={20}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({page: 0, checked: {test1: true, test2: true}});

        await wrapper.instance().nextPage({preventDefault: jest.fn()});
        let state = wrapper.state();
        expect(state.checked).toEqual({});
        expect(state.page).toBe(1);
        expect(state.loading).toBe(false);

        await wrapper.instance().nextPage({preventDefault: jest.fn()});
        state = wrapper.state();
        expect(state.checked).toEqual({});
        expect(state.page).toBe(2);
        expect(state.loading).toBe(false);
    });

    test('should match snapshot, with filters open', () => {
        const wrapper = shallow(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({showFilters: true, filterIsLinked: true, filterIsUnlinked: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('clicking the clear icon clears searchString', () => {
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({searchString: 'foo'});
        wrapper.find('i.fa-times-circle').first().simulate('click');
        expect(wrapper.state().searchString).toEqual('');
    });

    test('clicking the down arrow opens the filters', () => {
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        expect(wrapper.state().showFilters).toEqual(false);
        wrapper.find('i.fa-caret-down').first().simulate('click');
        expect(wrapper.state().showFilters).toEqual(true);
    });

    test('clicking search invokes getLdapGroups', () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({showFilters: true, searchString: 'foo iS:ConfiGuReD is:notlinked'});
        expect(wrapper.state().filterIsConfigured).toEqual(false);
        expect(wrapper.state().filterIsUnlinked).toEqual(false);

        wrapper.find('a.search-groups-btn').first().simulate('click');
        expect(getLdapGroups).toHaveBeenCalledTimes(2);
        expect(getLdapGroups).toHaveBeenCalledWith(0, 200, {q: 'foo', is_configured: true, is_linked: false});
        expect(wrapper.state().filterIsConfigured).toEqual(true);
        expect(wrapper.state().filterIsUnlinked).toEqual(true);
    });

    test('checking a filter checkbox add the filter to the searchString', () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({showFilters: true, searchString: 'foo'});
        wrapper.find('span.filter-check').first().simulate('click');
        expect(wrapper.state().searchString).toEqual('foo is:linked');
    });

    test('unchecking a filter checkbox removes the filter from the searchString', () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const wrapper = shallow<GroupsList>(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        wrapper.setState({showFilters: true, searchString: 'foo is:linked', filterIsLinked: true});
        wrapper.find('span.filter-check').first().simulate('click');
        expect(wrapper.state().searchString).toEqual('foo');
    });
});
