// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SystemUserDetail from 'components/admin_console/system_user_detail/system_user_detail';

import {Constants} from 'utils/constants';

jest.mock('actions/admin_actions.jsx');

describe('components/admin_console/system_user_detail', () => {
    const defaultProps = {
        user: {
            username: 'jim.halpert',
            first_name: 'Jim',
            last_name: 'Halpert',
            nickname: 'Big Tuna',
            id: '1234',
            roles: 'system_user',
        },
        actions: {
            updateUserActive: jest.fn(),
            setNavigationBlocked: jest.fn(),
            addUserToTeam: jest.fn(),
        },
    } as any;

    test('should match default snapshot', () => {
        const props = defaultProps;
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should redirect if user id is not defined', () => {
        const props = {
            ...defaultProps,
            user: {
                id: null,
            },
        };
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if user is inactive', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                delete_at: 1561683854166,
            },
        };
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if MFA is enabled', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                mfa_active: 'MFA',
            },
            mfaEnabled: true,
        };
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if no nickname is defined', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                nickname: null,
            },
        };
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if LDAP Authentication', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                auth_service: Constants.LDAP_SERVICE,
            },
        };
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if SAML Authentication', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                auth_service: Constants.SAML_SERVICE,
            },
            mfaEnabled: true,
        };
        const wrapper = shallow(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
