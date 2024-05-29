// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {TestHelper} from 'utils/test_helper';

import ChannelMembers from './channel_members';

describe('admin_console/team_channel_settings/channel/ChannelMembers', () => {
    const user1: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-1'}));
    const membership1: ChannelMembership = Object.assign(TestHelper.getChannelMembershipMock({user_id: 'user-1'}, {}));
    const user2: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-2'}));
    const membership2: ChannelMembership = Object.assign(TestHelper.getChannelMembershipMock({user_id: 'user-2'}, {}));
    const user3: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-3'}));
    const membership3: ChannelMembership = Object.assign(TestHelper.getChannelMembershipMock({user_id: 'user-3'}, {}));
    const channel: Channel = Object.assign(TestHelper.getChannelMock({id: 'channel-1'}));

    const baseProps = {
        filters: {},
        usersToRemove: {},
        usersToAdd: {},
        onAddCallback: jest.fn(),
        onRemoveCallback: jest.fn(),
        updateRole: jest.fn(),
        channelId: 'channel-1',
        loading: false,
        channel,
        users: [user1, user2, user3],
        channelMembers: {
            [user1.id]: membership1,
            [user2.id]: membership2,
            [user3.id]: membership3,
        },
        totalCount: 3,
        searchTerm: '',
        enableGuestAccounts: true,
        actions: {
            getChannelStats: jest.fn(),
            loadProfilesAndReloadChannelMembers: jest.fn(),
            searchProfilesAndChannelMembers: jest.fn(),
            getFilteredUsersStats: jest.fn(),
            setUserGridSearch: jest.fn(),
            setUserGridFilters: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelMembers {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot loading no users', () => {
        const wrapper = shallow(
            <ChannelMembers
                {...baseProps}
                users={[]}
                channelMembers={{}}
                totalCount={0}
                loading={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
