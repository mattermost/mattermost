// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import UserGroupsModalHeader from './user_groups_modal_header';

describe('component/user_groups_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        backButtonAction: jest.fn(),
        canCreateCustomGroups: true,
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot without groups', () => {
        const wrapper = shallow(
            <UserGroupsModalHeader
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with groups', () => {
        const wrapper = shallow(
            <UserGroupsModalHeader
                {...baseProps}
                canCreateCustomGroups={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
