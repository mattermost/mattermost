// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactWrapper} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import UserGroupPopover from './user_group_popover';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('react-virtualized-auto-sizer', () =>
    ({children}: {children: any}) => children({height: 100, width: 100}),
);

const actImmediate = (wrapper: ReactWrapper) =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    wrapper.update();
                    resolve();
                });
            }),
    );

describe('component/user_group_popover', () => {
    const profiles: Record<string, UserProfile> = {};
    const profilesInGroup: Record<Group['id'], Set<UserProfile['id']>> = {};

    const group1 = TestHelper.getGroupMock({
        id: 'group1',
        member_count: 15,
    });

    const group2 = TestHelper.getGroupMock({
        id: 'group2',
        member_count: 5,
    });

    profilesInGroup[group1.id] = new Set();
    profilesInGroup[group2.id] = new Set();

    for (let i = 0; i < 15; ++i) {
        const user = TestHelper.getUserMock({
            id: 'id' + i,
            username: 'username' + i,
            first_name: 'Name' + i,
            last_name: 'Surname' + i,
            email: 'test' + i + '@test.com',
        });
        profiles[user.id] = user;
        profilesInGroup[group1.id].add(user.id);
        if (i < 5) {
            profilesInGroup[group2.id].add(user.id);
        }
    }

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            general: {
                config: {},
            },
            users: {
                profiles,
                profilesInGroup,
            },
            preferences: {
                myPreferences: {},
            },
        },
        views: {
            modals: {
                modalState: {},
            },
            search: {
                popoverSearch: '',
            },
        },
    };

    const baseProps = {
        searchTerm: '',
        group: group1,
        canManageGroup: true,
        showUserOverlay: jest.fn(),
        hide: jest.fn(),
        returnFocus: jest.fn(),
        actions: {
            setPopoverSearchTerm: jest.fn(),
            openModal: jest.fn(),
            searchProfiles: jest.fn().mockImplementation(() => Promise.resolve()),
        },
    };

    test('should match snapshot', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <UserGroupPopover
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper).toMatchSnapshot();
    });

    test('should open modal', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <UserGroupPopover
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        expect(wrapper.find('button.user-group-popover_header-button').exists()).toBe(true);
        wrapper.find('button.user-group-popover_header-button').simulate('click');
        expect(baseProps.actions.openModal).toBeCalled();
        expect(baseProps.hide).toBeCalled();
    });

    test('should not show search bar', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <UserGroupPopover
                        {...baseProps}
                        group={group2}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        expect(wrapper.find('.user-group-popover_search-bar').exists()).toBe(false);
    });

    test('should show and set search term', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <UserGroupPopover
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        expect(wrapper.find('.user-group-popover_search-bar input').exists()).toBe(true);
        wrapper.find('.user-group-popover_search-bar input').simulate('change', {target: {value: 'a'}});
        expect(baseProps.actions.setPopoverSearchTerm).toHaveBeenCalledWith('a');
    });

    test('should show users', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <UserGroupPopover
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.group-member-list_item').length).toBeGreaterThan(0);
    });
});
