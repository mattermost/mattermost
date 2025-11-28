// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow, type ShallowWrapper} from 'enzyme';
import React from 'react';

import GuestPermissionsTree from 'components/admin_console/permission_schemes_settings/guest_permissions_tree/guest_permissions_tree';
import PermissionGroup from 'components/admin_console/permission_schemes_settings/permission_group';
import type {Permission} from 'components/admin_console/permission_schemes_settings/permissions_tree/types';

import {LicenseSkus} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('components/admin_console/permission_schemes_settings/permission_tree', () => {
    const defaultProps = {
        scope: 'channel_scope',
        role: TestHelper.getRoleMock(
            {
                name: 'test',
                permissions: [],
            },
        ),
        onToggle: jest.fn(),
        selectRow: jest.fn(),
        parentRole: undefined,
        readOnly: false,
        license: {
            SkuShortName: LicenseSkus.Professional,
            IsLicensed: 'true',
        },
    };

    test('should match snapshot on default data', () => {
        const wrapper = shallow(
            <GuestPermissionsTree {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on read only', () => {
        const wrapper = shallow(
            <GuestPermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on team scope', () => {
        const wrapper = shallow(
            <GuestPermissionsTree
                {...defaultProps}
                scope={'team_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on system scope', () => {
        const wrapper = shallow(
            <GuestPermissionsTree
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with parentRole with permissions', () => {
        const defaultParentRole = TestHelper.getRoleMock({permissions: ['invite_user']});
        const wrapper = shallow(
            <GuestPermissionsTree
                {...defaultProps}
                parentRole={defaultParentRole}
                scope={'system_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should ask to toggle on row toggle', () => {
        const onToggle = jest.fn();
        const wrapper = shallow(
            <GuestPermissionsTree
                {...defaultProps}
                onToggle={onToggle}
            />,
        );
        wrapper.find(PermissionGroup).first().prop('onChange')(['test_permission', 'test_permission2']);
        expect(onToggle).toHaveBeenCalledWith('test', ['test_permission', 'test_permission2']);
    });

    describe('USE_GROUP_MENTIONS permission', () => {
        const hasGroupMentionsPermission = (wrapper: ShallowWrapper): boolean => {
            const permissionGroup = wrapper.find(PermissionGroup).first();
            const permissions = permissionGroup.prop('permissions') as Array<Permission | string>;
            return permissions.some((permission: Permission | string) => {
                if (typeof permission === 'object' && permission.permissions) {
                    return permission.permissions.includes('use_group_mentions');
                }
                return permission === 'use_group_mentions';
            });
        };

        [LicenseSkus.Professional, LicenseSkus.Enterprise, LicenseSkus.EnterpriseAdvanced, LicenseSkus.Entry].forEach((sku) => {
            test(`should include group mentions for ${sku} license`, () => {
                const wrapper = shallow(
                    <GuestPermissionsTree
                        {...defaultProps}
                        license={{
                            SkuShortName: sku,
                            IsLicensed: 'true',
                        }}
                    />,
                );
                expect(hasGroupMentionsPermission(wrapper)).toBe(true);
            });
        });

        [LicenseSkus.Starter, LicenseSkus.E10, ''].forEach((sku) => {
            test(`should NOT include group mentions for ${sku || 'unlicensed'}`, () => {
                const wrapper = shallow(
                    <GuestPermissionsTree
                        {...defaultProps}
                        license={{
                            SkuShortName: sku,
                            IsLicensed: sku === '' ? 'false' : 'true',
                        }}
                    />,
                );
                expect(hasGroupMentionsPermission(wrapper)).toBe(false);
            });
        });
    });
});
