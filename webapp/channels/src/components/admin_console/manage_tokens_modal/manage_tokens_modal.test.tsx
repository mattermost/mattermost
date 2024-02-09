// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import ManageTokensModal from './manage_tokens_modal';

describe('components/admin_console/manage_tokens_modal/manage_tokens_modal.tsx', () => {
    const baseProps = {
        actions: {
            getUserAccessTokensForUser: jest.fn(),
        },
        user: TestHelper.getUserMock({
            id: 'defaultuser',
        }),
        onHide: jest.fn(),
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ManageTokensModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should not call getUserAccessTokensForUser on mount', () => {
        const wrapper = shallow(
            <ManageTokensModal {...baseProps}/>,
        );
        expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalledTimes(0);
        expect(wrapper.state('userAccessTokens')).toBeUndefined();
    });

    test('should call getUserAccessTokensForUser on user change', () => {
        // create new user as only by then the update method triggers token retrieval
        const newProps = {
            ...baseProps,
            user: TestHelper.getUserMock({
                id: 'newuser',
            }),
        };
        const wrapper = shallow(
            <ManageTokensModal {...baseProps}/>,
        );
        wrapper.setProps(newProps);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        wrapper.instance().componentDidUpdate(baseProps, newProps);
        expect(newProps.actions.getUserAccessTokensForUser).toHaveBeenCalledTimes(2);
    });
});
