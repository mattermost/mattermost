// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import UsersToRemoveRole from './users_to_remove_role';

describe('components/admin_console/team_channel_settings/group/UsersToRemoveRole', () => {
    const groups = [TestHelper.getGroupMock({id: 'group1', display_name: 'group1'})];
    const userWithGroups = {
        ...TestHelper.getUserMock(),
        groups,
    };

    const adminUserWithGroups = {
        ...TestHelper.getUserMock({roles: 'system_admin system_user'}),
        groups,
    };

    const guestUserWithGroups = {
        ...TestHelper.getUserMock({roles: 'system_guest'}),
        groups,
    };

    const teamMembership = TestHelper.getTeamMembershipMock({scheme_admin: false});
    const adminTeamMembership = TestHelper.getTeamMembershipMock({scheme_admin: true});
    const channelMembership = TestHelper.getChannelMembershipMock({scheme_admin: false}, {});
    const adminChannelMembership = TestHelper.getChannelMembershipMock({scheme_admin: true}, {});
    const guestMembership = TestHelper.getTeamMembershipMock({scheme_admin: false, scheme_user: false});

    const scopeTeam: 'team' | 'channel' = 'team';
    const scopeChannel: 'team' | 'channel' = 'channel';

    test('should match snapshot scope team and regular membership', () => {
        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <UsersToRemoveRole
                    user={userWithGroups}
                    scope={scopeTeam}
                    membership={teamMembership}
                />
            </IntlProvider>,
        ).childAt(0);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot scope team and admin membership', () => {
        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <UsersToRemoveRole
                    user={userWithGroups}
                    scope={scopeTeam}
                    membership={adminTeamMembership}
                />
            </IntlProvider>,
        ).childAt(0);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot scope channel and regular membership', () => {
        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <UsersToRemoveRole
                    user={userWithGroups}
                    scope={scopeChannel}
                    membership={channelMembership}
                />
            </IntlProvider>,
        ).childAt(0);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot scope channel and admin membership', () => {
        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <UsersToRemoveRole
                    user={userWithGroups}
                    scope={scopeChannel}
                    membership={adminChannelMembership}
                />
            </IntlProvider>,
        ).childAt(0);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot scope channel and admin membership but user is sys admin', () => {
        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <UsersToRemoveRole
                    user={adminUserWithGroups}
                    scope={scopeChannel}
                    membership={adminChannelMembership}
                />
            </IntlProvider>,
        ).childAt(0);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot guest', () => {
        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <UsersToRemoveRole
                    user={guestUserWithGroups}
                    scope={scopeTeam}
                    membership={guestMembership}
                />
            </IntlProvider>,
        ).childAt(0);
        expect(wrapper).toMatchSnapshot();
    });
});
