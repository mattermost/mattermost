// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import PermissionCheckbox from './permission_checkbox';

describe('components/admin_console/permission_schemes_settings/permission_checkbox', () => {
    test('should match snapshot on no value', () => {
        const {baseElement} = renderWithContext(
            <PermissionCheckbox/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on value "checked" and no id', () => {
        const {baseElement} = renderWithContext(
            <PermissionCheckbox value='checked'/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on value "checked"', () => {
        const {baseElement} = renderWithContext(
            <PermissionCheckbox
                value='checked'
                id='uniqId-checked'
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on value "intermediate"', () => {
        const {baseElement} = renderWithContext(
            <PermissionCheckbox
                value='intermediate'
                id='uniqId-checked'
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on other value', () => {
        const {baseElement} = renderWithContext(
            <PermissionCheckbox
                value='other'
                id='uniqId-checked'
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });
});
