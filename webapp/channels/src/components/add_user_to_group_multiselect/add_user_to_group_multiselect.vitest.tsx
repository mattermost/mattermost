// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {Value} from 'components/multiselect/multiselect';

import {renderWithContext, cleanup, act} from 'tests/vitest_react_testing_utils';

import AddUserToGroupMultiSelect from './add_user_to_group_multiselect';

type UserProfileValue = Value & UserProfile;

describe('component/add_user_to_group_multiselect', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        await act(async () => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
        cleanup();
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

    const userStatuses = {
        'user-1': 'online',
        'user-2': 'offline',
    } as RelationOneToOne<UserProfile, string>;

    const baseProps = {
        multilSelectKey: 'addUsersToGroupKey',
        onSubmitCallback: vi.fn().mockImplementation(() => Promise.resolve()),
        focusOnLoad: false,
        savingEnabled: false,
        addUserCallback: vi.fn(),
        deleteUserCallback: vi.fn(),
        profiles: [],
        userStatuses: {},
        saving: false,
        actions: {
            getProfiles: vi.fn().mockImplementation(() => Promise.resolve()),
            getProfilesNotInGroup: vi.fn().mockImplementation(() => Promise.resolve()),
            loadStatusesForProfilesList: vi.fn().mockImplementation(() => Promise.resolve()),
            searchProfiles: vi.fn(),
        },
    };

    test('should match snapshot without any profiles', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUserToGroupMultiSelect
                    {...baseProps}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });
        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with profiles', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUserToGroupMultiSelect
                    {...baseProps}
                    profiles={users}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });
        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with different submit button text', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUserToGroupMultiSelect
                    {...baseProps}
                    profiles={users}
                    userStatuses={userStatuses}
                    buttonSubmitLoadingText='Updating...'
                    buttonSubmitText='Update Group'
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });
        expect(container!).toMatchSnapshot();
    });
});
