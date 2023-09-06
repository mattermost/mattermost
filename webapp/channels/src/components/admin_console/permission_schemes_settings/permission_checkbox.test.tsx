// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PermissionCheckbox from 'components/admin_console/permission_schemes_settings/permission_checkbox';

describe('components/admin_console/permission_schemes_settings/permission_checkbox', () => {
    test('should match snapshot on no value', () => {
        const wrapper = shallow(
            <PermissionCheckbox/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on value "checked" and no id', () => {
        const wrapper = shallow(
            <PermissionCheckbox value='checked'/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on value "checked"', () => {
        const wrapper = shallow(
            <PermissionCheckbox
                value='checked'
                id='uniqId-checked'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on value "intermediate"', () => {
        const wrapper = shallow(
            <PermissionCheckbox
                value='intermediate'
                id='uniqId-checked'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on other value', () => {
        const wrapper = shallow(
            <PermissionCheckbox
                value='other'
                id='uniqId-checked'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
