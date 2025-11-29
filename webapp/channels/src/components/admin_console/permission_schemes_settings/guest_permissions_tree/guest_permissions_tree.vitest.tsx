// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GuestPermissionsTree from 'components/admin_console/permission_schemes_settings/guest_permissions_tree/guest_permissions_tree';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/admin_console/permission_schemes_settings/permission_tree', () => {
    const defaultProps = {
        scope: 'channel_scope',
        role: TestHelper.getRoleMock({
            name: 'test',
            permissions: [],
        }),
        onToggle: vi.fn(),
        selectRow: vi.fn(),
        parentRole: undefined,
        readOnly: false,
        license: {
            LDAPGroups: 'true',
            IsLicensed: 'true',
        },
    };

    test('should match snapshot on default data', () => {
        const {container} = renderWithContext(
            <GuestPermissionsTree {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on read only', () => {
        const {container} = renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on team scope', () => {
        const {container} = renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                scope={'team_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on system scope', () => {
        const {container} = renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with parentRole with permissions', () => {
        const defaultParentRole = TestHelper.getRoleMock({permissions: ['invite_user']});
        const {container} = renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                parentRole={defaultParentRole}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should ask to toggle on row toggle', () => {
        const {container} = renderWithContext(
            <GuestPermissionsTree {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on license without LDAPGroups', () => {
        const {container} = renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                license={{}}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
