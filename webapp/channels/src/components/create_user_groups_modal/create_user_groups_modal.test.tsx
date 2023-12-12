// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import type {Value} from 'components/multiselect/multiselect';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import CreateUserGroupsModal from './create_user_groups_modal';
import type {CreateUserGroupsModal as CreateUserGroupsModalClass} from './create_user_groups_modal';

type UserProfileValue = Value & UserProfile;

describe('component/create_user_groups_modal', () => {
    const users = [{
        id: 'user-1',
        label: 'user-1',
        value: 'user-1',
        delete_at: 0,
    } as UserProfileValue, {
        id: 'user-2',
        label: 'user-2',
        value: 'user-2',
        delete_at: 0,
    } as UserProfileValue];

    const baseProps = {
        onExited: jest.fn(),
        backButtonCallback: jest.fn(),
        actions: {
            openModal: jest.fn(),
            createGroupWithUserIds: jest.fn().mockImplementation(() => Promise.resolve()),
        },
    };

    test('should match snapshot with back button', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot without back button', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
                backButtonCallback={undefined}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should create group', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: 'ursa', usersToAdd: users});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('');
        });
    });

    test('mention regex error', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: 'ursa!/'});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('Invalid character in mention.');
        });
    });

    test('create a mention with special characters', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: 'ursa.-_'});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('');
        });
    });

    test('fail to create with empty name', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: '', mention: 'ursa'});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('nameInputErrorText')).toEqual('Name is a required field.');
        });
    });

    test('fail to create with empty mention', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: ''});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('Mention is a required field.');
        });
    });

    test('should create when mention begins with @', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('');
            expect(wrapper.state('nameInputErrorText')).toEqual('');
        });
    });

    test('should fail to create with unknown error', () => {
        const createGroupWithUserIds = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error', server_error_id: 'insert_error'}}));

        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(instance.props.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(true);
            expect(wrapper.state('mentionInputErrorText')).toEqual('');
            expect(wrapper.state('nameInputErrorText')).toEqual('');
        });
    });

    test('should fail to create with duplicate mention error', () => {
        const createGroupWithUserIds = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error', server_error_id: 'app.custom_group.unique_name'}}));

        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(instance.props.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('Mention needs to be unique.');
            expect(wrapper.state('nameInputErrorText')).toEqual('');
        });
    });

    test('fail to create with reserved word for mention', () => {
        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: 'all'});
        let instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('Mention contains a reserved word.');
        });

        wrapper.setState({name: 'Ursa', mention: 'here'});
        instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('Mention contains a reserved word.');
        });

        wrapper.setState({name: 'Ursa', mention: 'channel'});
        instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('Mention contains a reserved word.');
        });
    });
    test('should fail to create with duplicate mention error', () => {
        const createGroupWithUserIds = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error', server_error_id: 'app.group.username_conflict'}}));

        const wrapper = shallowWithIntl(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );
        wrapper.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        const instance = wrapper.instance() as CreateUserGroupsModalClass;
        instance.createGroup(users);
        expect(instance.props.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('showUnknownError')).toEqual(false);
            expect(wrapper.state('mentionInputErrorText')).toEqual('A username already exists with this name. Mention must be unique.');
            expect(wrapper.state('nameInputErrorText')).toEqual('');
        });
    });
});
