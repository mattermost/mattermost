// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import type {Value} from 'components/multiselect/multiselect';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';

import {CreateUserGroupsModal} from './create_user_groups_modal';

type UserProfileValue = Value & UserProfile;

describe('component/create_user_groups_modal', () => {
    const originalRAF = window.requestAnimationFrame;

    beforeEach(() => {
        window.requestAnimationFrame = jest.fn();
    });

    afterEach(() => {
        window.requestAnimationFrame = originalRAF;
    });
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
        intl: defaultIntl,
        onExited: jest.fn(),
        backButtonCallback: jest.fn(),
        actions: {
            openModal: jest.fn(),
            createGroupWithUserIds: jest.fn().mockImplementation(() => Promise.resolve()),
        },
    };

    test('should match snapshot with back button', () => {
        const {container} = renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot without back button', () => {
        const {container} = renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                backButtonCallback={undefined}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should create group', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: 'ursa', usersToAdd: users});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect(ref.current!.state.mentionInputErrorText).toEqual('');
    });

    test('mention regex error', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: 'ursa!/'});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Invalid character in mention.');
    });

    test('create a mention with special characters', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: 'ursa.-_'});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect(ref.current!.state.mentionInputErrorText).toEqual('');
    });

    test('fail to create with empty name', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: '', mention: 'ursa'});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.nameInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Name is a required field.');
    });

    test('fail to create with empty mention', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: ''});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Mention is a required field.');
    });

    test('should create when mention begins with @', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect(ref.current!.state.mentionInputErrorText).toEqual('');
        expect(ref.current!.state.nameInputErrorText).toEqual('');
    });

    test('should fail to create with unknown error', async () => {
        const createGroupWithUserIds = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error', server_error_id: 'insert_error'}}));

        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(ref.current!.props.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        expect(ref.current!.state.showUnknownError).toEqual(true);
        expect(ref.current!.state.mentionInputErrorText).toEqual('');
        expect(ref.current!.state.nameInputErrorText).toEqual('');
    });

    test('should fail to create with duplicate mention error', async () => {
        const createGroupWithUserIds = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error', server_error_id: 'app.custom_group.unique_name'}}));

        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(ref.current!.props.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Mention needs to be unique.');
        expect(ref.current!.state.nameInputErrorText).toEqual('');
    });

    test('fail to create with reserved word for mention', async () => {
        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: 'all'});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Mention contains a reserved word.');

        act(() => {
            ref.current!.setState({name: 'Ursa', mention: 'here'});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Mention contains a reserved word.');

        act(() => {
            ref.current!.setState({name: 'Ursa', mention: 'channel'});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(baseProps.actions.createGroupWithUserIds).toHaveBeenCalledTimes(0);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('Mention contains a reserved word.');
    });

    test('should fail to create with duplicate mention error (username_conflict)', async () => {
        const createGroupWithUserIds = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error', server_error_id: 'app.group.username_conflict'}}));

        const ref = React.createRef<CreateUserGroupsModal>();
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({name: 'Ursa', mention: '@ursa', usersToAdd: users});
        });
        await act(async () => {
            ref.current!.createGroup(users);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(ref.current!.props.actions.createGroupWithUserIds).toHaveBeenCalledTimes(1);
        expect(ref.current!.state.showUnknownError).toEqual(false);
        expect((ref.current!.state.mentionInputErrorText as React.JSX.Element).props.defaultMessage).toEqual('A username already exists with this name. Mention must be unique.');
        expect(ref.current!.state.nameInputErrorText).toEqual('');
    });
});
