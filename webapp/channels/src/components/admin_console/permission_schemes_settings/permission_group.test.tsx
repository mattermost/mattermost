// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import PermissionGroup from 'components/admin_console/permission_schemes_settings/permission_group';

describe('components/admin_console/permission_schemes_settings/permission_group', () => {
    const defaultProps = {
        id: 'name',
        uniqId: 'uniqId',
        permissions: ['invite_user', 'add_user_to_team'],
        readOnly: false,
        role: {
            permissions: [],
        },
        parentRole: undefined,
        scope: 'team_scope',
        value: 'checked',
        selectRow: jest.fn(),
        onChange: jest.fn(),
    };

    test('should match snapshot on editable without permissions', () => {
        const wrapper = shallow(
            <PermissionGroup {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable without every permission out of the scope', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable with some permissions', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable with all permissions', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable without permissions and read-only', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable with some permissions and read-only', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable with all permissions and read-only', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable with some permissions from parentRole', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                parentRole={{permissions: ['invite_user']}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable with all permissions from parentRole', () => {
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                parentRole={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should expand and collapse correctly, expanded by default, collapsed and then expanded again', () => {
        const wrapper = shallow(
            <PermissionGroup {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        wrapper.find('.permission-arrow').first().simulate('click', {stopPropagation: jest.fn()});
        expect(wrapper).toMatchSnapshot();
        wrapper.find('.permission-arrow').first().simulate('click', {stopPropagation: jest.fn()});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call correctly onChange function on click without permissions', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                onChange={onChange}
            />,
        );
        wrapper.find('.permission-group-row').first().simulate('click');
        expect(onChange).toBeCalledWith(['invite_user', 'add_user_to_team']);
    });

    test('should call correctly onChange function on click with some permissions', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );
        wrapper.find('.permission-group-row').first().simulate('click');
        expect(onChange).toBeCalledWith(['add_user_to_team']);
    });

    test('should call correctly onChange function on click with all permissions', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                onChange={onChange}
            />,
        );
        wrapper.find('.permission-group-row').first().simulate('click');
        expect(onChange).toBeCalledWith(['invite_user', 'add_user_to_team']);
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        wrapper.find('.permission-group-row').first().simulate('click');
        expect(onChange).not.toBeCalled();
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        wrapper.find('.permission-group-row').first().simulate('click');
        expect(onChange).not.toBeCalled();
    });

    test('should collapse when toggle to all permissions and expand otherwise', () => {
        let wrapper = shallow<PermissionGroup>(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
            />,
        );
        expect(wrapper.state().expanded).toBe(true);
        wrapper.instance().toggleSelectGroup();
        expect(wrapper.state().expanded).toBe(false);

        wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );
        wrapper.setState({expanded: false});
        wrapper.instance().toggleSelectGroup();
        expect(wrapper.state().expanded).toBe(true);

        wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: []}}
            />,
        );
        wrapper.setState({expanded: false, prevPermissions: ['invite_user']});
        wrapper.instance().toggleSelectGroup();
        expect(wrapper.state().expanded).toBe(true);
    });

    test('should toggle correctly between states', () => {
        let onChange = jest.fn();
        let wrapper = shallow<PermissionGroup>(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );
        wrapper.setState({prevPermissions: ['invite_user']});
        wrapper.instance().toggleSelectGroup();
        expect(onChange).toBeCalledWith(['add_user_to_team']);

        onChange = jest.fn();
        wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                onChange={onChange}
            />,
        );
        wrapper.setState({prevPermissions: ['invite_user']});
        wrapper.instance().toggleSelectGroup();
        expect(onChange).toBeCalledWith(['invite_user', 'add_user_to_team']);

        onChange = jest.fn();
        wrapper = shallow(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: []}}
                onChange={onChange}
            />,
        );
        wrapper.setState({prevPermissions: ['invite_user']});
        wrapper.instance().toggleSelectGroup();
        expect(onChange).toBeCalledWith(['invite_user']);
    });
});
