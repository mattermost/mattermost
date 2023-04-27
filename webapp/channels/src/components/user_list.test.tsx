// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import UserList from './user_list';

describe('components/UserList', () => {
    test('should match default snapshot', () => {
        const props = {
            actionProps: {
                mfaEnabled: false,
                enableUserAccessTokens: false,
                experimentalEnableAuthenticationTransfer: false,
                doPasswordReset: jest.fn(),
                doEmailReset: jest.fn(),
                doManageTeams: jest.fn(),
                doManageRoles: jest.fn(),
                doManageTokens: jest.fn(),
                isDisabled: false,
            },
        };
        const wrapper = shallow(
            <UserList {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match default snapshot when there are users', () => {
        const User1 = TestHelper.getUserMock({id: 'id1'});
        const User2 = TestHelper.getUserMock({id: 'id2'});
        const props = {
            users: [
                User1,
                User2,
            ],
            actionUserProps: {},
            actionProps: {
                mfaEnabled: false,
                enableUserAccessTokens: false,
                experimentalEnableAuthenticationTransfer: false,
                doPasswordReset: jest.fn(),
                doEmailReset: jest.fn(),
                doManageTeams: jest.fn(),
                doManageRoles: jest.fn(),
                doManageTokens: jest.fn(),
                isDisabled: false,
            },
        };

        const wrapper = shallow(
            <UserList {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
