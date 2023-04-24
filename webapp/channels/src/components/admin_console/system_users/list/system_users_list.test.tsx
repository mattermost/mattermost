// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';
import SystemUsersList from 'components/admin_console/system_users/list/system_users_list';

describe('components/admin_console/system_users/list', () => {
    const defaultProps = {
        users: [] as UserProfile[],
        usersPerPage: 0,
        total: 0,
        nextPage: jest.fn(),
        search: jest.fn(),
        focusOnMount: false,
        renderFilterRow: jest.fn(),
        teamId: '',
        filter: '',
        term: '',
        onTermChange: jest.fn(),
        mfaEnabled: false,
        enableUserAccessTokens: false,
        experimentalEnableAuthenticationTransfer: false,
        actions: {
            getUser: jest.fn(),
            updateTeamMemberSchemeRoles: jest.fn(),
            getTeamMembersForUser: jest.fn(),
            getTeamsForUser: jest.fn(),
            removeUserFromTeam: jest.fn(),
        },
        isDisabled: false,
    };

    test('should match default snapshot', () => {
        const props = defaultProps;
        const wrapper = shallow(<SystemUsersList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    describe('should match default snapshot, with users', () => {
        const props = {
            ...defaultProps,
            users: [
                {id: 'id1'},
                {id: 'id2'},
                {id: 'id3', auth_service: Constants.LDAP_SERVICE},
                {id: 'id4', auth_service: Constants.SAML_SERVICE},
                {id: 'id5', auth_service: 'other service'},
            ] as UserProfile[],
        };

        it('and mfa enabled', () => {
            const wrapper = shallow(
                <SystemUsersList
                    {...props}
                    mfaEnabled={true}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('and mfa disabled', () => {
            const wrapper = shallow(
                <SystemUsersList
                    {...props}
                    mfaEnabled={false}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('should reset page', () => {
        it('when team changes', () => {
            const wrapper = shallow(
                <SystemUsersList {...defaultProps}/>,
            );

            expect(wrapper.state('page')).toBe(0);
            (wrapper.instance() as SystemUsersList).nextPage();
            expect(wrapper.state('page')).toBe(1);
            wrapper.setProps({...defaultProps, teamId: 'new'});
            expect(wrapper.state('page')).toBe(0);
        });

        it('when filter changes', () => {
            const wrapper = shallow(
                <SystemUsersList {...defaultProps}/>,
            );

            expect(wrapper.state('page')).toBe(0);
            (wrapper.instance() as SystemUsersList).nextPage();
            expect(wrapper.state('page')).toBe(1);
            wrapper.setProps({...defaultProps, filter: 'new'});
            expect(wrapper.state('page')).toBe(0);
        });
    });

    describe('should not reset page', () => {
        it('when term changes', () => {
            const wrapper = shallow(
                <SystemUsersList {...defaultProps}/>,
            );

            expect(wrapper.state('page')).toBe(0);
            (wrapper.instance() as SystemUsersList).nextPage();
            expect(wrapper.state('page')).toBe(1);
            wrapper.setProps({...defaultProps, term: 'new term'});
            expect(wrapper.state('page')).toBe(1);
        });
    });
});
