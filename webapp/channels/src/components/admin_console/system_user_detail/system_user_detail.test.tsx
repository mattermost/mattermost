// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import SystemUserDetail from 'components/admin_console/system_user_detail/system_user_detail';
import type {
    Props,
    Params,
} from 'components/admin_console/system_user_detail/system_user_detail';

import {shallowWithIntl, type MockIntl} from 'tests/helpers/intl-test-helper';

describe('components/admin_console/system_user_detail', () => {
    const defaultProps: Props = {
        mfaEnabled: false,
        patchUser: jest.fn(),
        updateUserMfa: jest.fn(),
        getUser: jest.fn(),
        updateUserActive: jest.fn(),
        setNavigationBlocked: jest.fn(),
        addUserToTeam: jest.fn(),
        intl: {
            formatMessage: jest.fn(),
        } as MockIntl,
        ...({
            match: {
                params: {
                    user_id: 'user_id',
                },
            },
        } as RouteComponentProps<Params>),
    };

    test('should match default snapshot', () => {
        const props = defaultProps;
        const wrapper = shallowWithIntl(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if MFA is enabled', () => {
        const props = {
            ...defaultProps,
            mfaEnabled: true,
        };
        const wrapper = shallowWithIntl(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
