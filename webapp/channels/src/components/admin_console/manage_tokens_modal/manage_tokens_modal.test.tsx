// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import LoadingScreen from 'components/loading_screen';

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

    test('initial call should match snapshot', () => {
        const wrapper = shallow(
            <ManageTokensModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalledTimes(1);
        expect(wrapper.find('.manage-teams__teams').exists()).toBe(true);
        expect(wrapper.find(LoadingScreen).exists()).toBe(true);
    });

    test('should replace loading screen on update', () => {
        const wrapper = shallow(
            <ManageTokensModal {...baseProps}/>,
        );

        const newProps = {
            ...baseProps,
            userAccessTokens: {},
        };
        wrapper.setProps(newProps);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.manage-teams__teams').exists()).toBe(true);
        expect(wrapper.find('.manage-row__empty').exists()).toBe(true);
    });

    test('should display list of tokens', () => {
        const wrapper = shallow(
            <ManageTokensModal {...baseProps}/>,
        );
        const newProps = {
            ...baseProps,
            userAccessTokens: [
                {
                    id: 'id1',
                    description: 'description',
                },
                {
                    id: 'id2',
                    description: 'description',
                },
            ],
        };
        wrapper.setProps(newProps);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.manage-teams__teams').exists()).toBe(true);
        expect(wrapper.find('.manage-teams__team').length).toBe(2);
    });
});
