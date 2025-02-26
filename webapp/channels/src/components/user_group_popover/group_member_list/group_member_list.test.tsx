// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactWrapper} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import GroupMemberList from './group_member_list';
import type {GroupMember} from './group_member_list';

import {Load} from '../constants';

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

describe('component/user_group_popover/group_member_list', () => {
    const profiles: Record<string, UserProfile> = {};
    const profilesInGroup: Record<Group['id'], Set<UserProfile['id']>> = {};
    const statuses: Record<UserProfile['id'], string> = {};

    const group = TestHelper.getGroupMock({
        member_count: 5,
    });

    const members: GroupMember[] = [];

    for (let i = 0; i < 5; ++i) {
        const user = TestHelper.getUserMock({
            id: 'id' + i,
            username: 'username' + i,
            first_name: 'Name' + i,
            last_name: 'Surname' + i,
            email: 'test' + i + '@test.com',
        });
        const displayName = displayUsername(user, General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME);
        members.push({user, displayName});
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
                statuses,
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
        group,
        canManageGroup: true,
        showUserOverlay: jest.fn(),
        hide: jest.fn(),
        searchState: Load.DONE,
        members,
        teamUrl: 'team',
        actions: {
            getUsersInGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            openDirectChannelToUserId: jest.fn().mockImplementation(() => Promise.resolve()),
            closeRightHandSide: jest.fn(),
        },
    };

    test('should match snapshot', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <GroupMemberList
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        expect(wrapper).toMatchSnapshot();
    });

    test('should open dms', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <GroupMemberList
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        wrapper.find('.group-member-list_dm-button').first().simulate('click');
        expect(baseProps.actions.openDirectChannelToUserId).toBeCalledTimes(0);
    });

    test('should show user overlay and hide', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <GroupMemberList
                        {...baseProps}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        wrapper.find('.group-member-list_item').first().simulate('click');
        expect(baseProps.showUserOverlay).toBeCalledTimes(0);
        expect(baseProps.hide).toBeCalledTimes(0);
    });
});
