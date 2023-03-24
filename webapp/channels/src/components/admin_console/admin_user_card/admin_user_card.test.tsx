// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import AdminUserCard from 'components/admin_console/admin_user_card/admin_user_card';

describe('components/admin_console/admin_user_card/admin_user_card', () => {
    const user = TestHelper.getUserMock({
        first_name: 'Jim',
        last_name: 'Halpert',
        nickname: 'Big Tuna',
        id: '1234',
    });

    const defaultProps = {
        user,
    } as any;

    test('should match default snapshot', () => {
        const props = defaultProps;
        const wrapper = shallow(<AdminUserCard {...props}/>);
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
        const wrapper = shallow(<AdminUserCard {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if no first/last name is defined', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                first_name: null,
                last_name: null,
            },
        };
        const wrapper = shallow(<AdminUserCard {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if no first/last name or nickname is defined', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                first_name: null,
                last_name: null,
                nickname: null,
            },
        };
        const wrapper = shallow(<AdminUserCard {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
