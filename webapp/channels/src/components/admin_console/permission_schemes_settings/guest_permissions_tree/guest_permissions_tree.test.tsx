// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Permission} from 'components/admin_console/permission_schemes_settings/permissions_tree/types';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import GuestPermissionsTree from './guest_permissions_tree';

jest.mock('components/admin_console/permission_schemes_settings/permission_group', () => {
    return jest.fn(() => <div data-testid='permission-group'/>);
});

const PermissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');

describe('components/admin_console/permission_schemes_settings/guest_permissions_tree', () => {
    const defaultProps = {
        scope: 'channel_scope',
        role: TestHelper.getRoleMock({
            name: 'test',
            permissions: [],
        }),
        onToggle: jest.fn(),
        selectRow: jest.fn(),
        parentRole: undefined,
        readOnly: false,
        license: {
            SkuShortName: LicenseSkus.Professional,
            IsLicensed: 'true',
        },
    };

    test('should render guest permissions tree with headers', () => {
        const {container} = renderWithContext(<GuestPermissionsTree {...defaultProps}/>);

        expect(screen.getByText('Permission')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByTestId('permission-group')).toBeInTheDocument();
        expect(container.querySelector('.permissions-tree.guest')).toBeInTheDocument();
    });

    test('should pass props correctly to PermissionGroup', () => {
        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                readOnly={true}
                scope={'team_scope'}
            />,
        );

        expect(PermissionGroup).toHaveBeenCalledWith(
            expect.objectContaining({
                readOnly: true,
                scope: 'team_scope',
            }),
            expect.anything(),
        );
    });

    describe('default guest permissions', () => {
        const verifyDefaultPermissions = (permissions: Array<Permission | string>, includeGroupMentions: boolean) => {
            const permissionIds = permissions.map((p) => (typeof p === 'string' ? p : p.id));

            expect(permissionIds).toContain('guest_create_private_channel');
            expect(permissionIds).toContain('guest_edit_post');
            expect(permissionIds).toContain('guest_delete_post');
            expect(permissionIds).toContain('guest_create_post');
            expect(permissionIds).toContain('guest_reactions');
            expect(permissionIds).toContain('guest_use_channel_mentions');

            if (includeGroupMentions) {
                expect(permissionIds).toContain('guest_use_group_mentions');
            } else {
                expect(permissionIds).not.toContain('guest_use_group_mentions');
            }

            const createPostPermission = permissions.find((p) => typeof p === 'object' && p.id === 'guest_create_post') as Permission;
            expect(createPostPermission).toBeDefined();
            expect(createPostPermission.combined).toBe(true);
            expect(createPostPermission.permissions).toEqual(['create_post', 'upload_file']);

            const reactionsPermission = permissions.find((p) => typeof p === 'object' && p.id === 'guest_reactions') as Permission;
            expect(reactionsPermission).toBeDefined();
            expect(reactionsPermission.combined).toBe(true);
            expect(reactionsPermission.permissions).toEqual(['add_reaction', 'remove_reaction']);
        };

        [LicenseSkus.Professional, LicenseSkus.Enterprise, LicenseSkus.EnterpriseAdvanced, LicenseSkus.Entry].forEach((sku) => {
            test(`should include all default permissions with group mentions for ${sku}`, () => {
                renderWithContext(
                    <GuestPermissionsTree
                        {...defaultProps}
                        license={{
                            SkuShortName: sku,
                            IsLicensed: 'true',
                        }}
                    />,
                );

                expect(PermissionGroup).toHaveBeenCalledTimes(1);
                const calls = PermissionGroup.mock.calls;
                const permissions = calls[0][0].permissions as Array<Permission | string>;
                verifyDefaultPermissions(permissions, true);
            });
        });

        [LicenseSkus.Starter, LicenseSkus.E10].forEach((sku) => {
            test(`should include all default permissions without group mentions for ${sku}`, () => {
                renderWithContext(
                    <GuestPermissionsTree
                        {...defaultProps}
                        license={{
                            SkuShortName: sku,
                            IsLicensed: 'true',
                        }}
                    />,
                );

                expect(PermissionGroup).toHaveBeenCalledTimes(1);
                const calls = PermissionGroup.mock.calls;
                const permissions = calls[0][0].permissions as Array<Permission | string>;
                verifyDefaultPermissions(permissions, false);
            });
        });

        test('should include all default permissions without group mentions for unlicensed', () => {
            renderWithContext(
                <GuestPermissionsTree
                    {...defaultProps}
                    license={{
                        SkuShortName: '',
                        IsLicensed: 'false',
                    }}
                />,
            );

            expect(PermissionGroup).toHaveBeenCalledTimes(1);
            const calls = PermissionGroup.mock.calls;
            const permissions = calls[0][0].permissions as Array<Permission | string>;
            verifyDefaultPermissions(permissions, false);
        });
    });

    test('should call onToggle when permissions are changed', () => {
        const onToggle = jest.fn();
        const role = TestHelper.getRoleMock({
            name: 'guest_role',
            permissions: [],
        });

        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                role={role}
                onToggle={onToggle}
            />,
        );

        const calls = PermissionGroup.mock.calls;
        const onChange = calls[0][0].onChange;
        onChange(['test_permission', 'test_permission2']);

        expect(onToggle).toHaveBeenCalledWith('guest_role', ['test_permission', 'test_permission2']);
    });
});
