// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {TestHelper} from 'utils/test_helper';

import SystemUsers from './system_users';

describe('admin_console/system_users', () => {
    const user1: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-1'}));
    const membership1: TeamMembership = Object.assign(TestHelper.getTeamMembershipMock({user_id: 'user-1'}));
    const user2: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-2'}));
    const membership2: TeamMembership = Object.assign(TestHelper.getTeamMembershipMock({user_id: 'user-2'}));
    const user3: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-3'}));
    const membership3: TeamMembership = Object.assign(TestHelper.getTeamMembershipMock({user_id: 'user-3'}));
    const team: Team = Object.assign(TestHelper.getTeamMock({id: 'team-1'}));

    const baseProps = {
        isMySql: false,
        currentUser: {
            id: 'userId',
        },

        // helpLink: 'helpLink',
        // isMobileView: false,
        // reportAProblemLink: 'reportAProblemLink',
        // enableAskCommunityLink: 'true',
        // location: {
        //     pathname: '/team/channel/channelId',
        // },
        // teamUrl: '/team',
        // actions: {
        //     openModal: jest.fn(),
        // },
        // pluginMenuItems: [],
        // isFirstAdmin: false,
        // onboardingFlowEnabled: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SystemUsers {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    // test('should match snapshot loading no users', () => {
    //     const wrapper = shallow(
    //         <SystemUsers
    //             {...baseProps}
    //             // users={[]}
    //             // teamMembers={{}}
    //             // totalCount={0}
    //             // loading={true}
    //         />,
    //     );
    //     expect(wrapper).toMatchSnapshot();
    // });
});
