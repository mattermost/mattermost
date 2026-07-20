// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {Value} from 'components/multiselect/multiselect';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';

import {AddUserToGroupMultiSelect} from './add_user_to_group_multiselect';
import type {AddUserToGroupMultiSelect as AddUserToGroupMultiSelectClass} from './add_user_to_group_multiselect';

type UserProfileValue = Value & UserProfile;

describe('component/add_user_to_group_multiselect', () => {
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

    const userStatuses = {
        'user-1': 'online',
        'user-2': 'offline',
    } as RelationOneToOne<UserProfile, string>;

    const baseProps = {
        multilSelectKey: 'addUsersToGroupKey',
        onSubmitCallback: jest.fn().mockImplementation(() => Promise.resolve()),
        focusOnLoad: false,
        savingEnabled: false,
        addUserCallback: jest.fn(),
        deleteUserCallback: jest.fn(),
        profiles: [],
        userStatuses: {},
        saving: false,
        intl: defaultIntl,
        actions: {
            getProfiles: jest.fn().mockImplementation(() => Promise.resolve()),
            getProfilesNotInGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            loadStatusesForProfilesList: jest.fn().mockImplementation(() => Promise.resolve()),
            searchProfiles: jest.fn(),
        },
    };

    test('should match snapshot without any profiles', () => {
        const {container} = renderWithContext(
            <AddUserToGroupMultiSelect
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with profiles', () => {
        const {container} = renderWithContext(
            <AddUserToGroupMultiSelect
                {...baseProps}
                profiles={users}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with different submit button text', () => {
        const {container} = renderWithContext(
            <AddUserToGroupMultiSelect
                {...baseProps}
                profiles={users}
                userStatuses={userStatuses}
                buttonSubmitLoadingText='Updating...'
                buttonSubmitText='Update Group'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should trim the search term', () => {
        const ref = React.createRef<AddUserToGroupMultiSelectClass>();
        renderWithContext(
            <AddUserToGroupMultiSelect
                {...baseProps}
                ref={ref}
            />,
        );

        act(() => {
            ref.current!.search(' something ');
        });
        expect(ref.current!.state.term).toEqual('something');
    });

    test('should add users on handleSubmit', (done) => {
        const ref = React.createRef<AddUserToGroupMultiSelectClass>();
        renderWithContext(
            <AddUserToGroupMultiSelect
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;

        act(() => {
            instance.setState({values: users});
        });
        act(() => {
            instance.handleSubmit();
        });
        expect(instance.props.onSubmitCallback).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            done();
        });
    });
});
