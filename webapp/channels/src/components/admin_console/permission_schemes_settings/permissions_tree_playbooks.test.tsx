// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import PermissionsTreePlaybooks from 'components/admin_console/permission_schemes_settings/permissions_tree_playbooks';

import {renderWithContext} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import type {Group, Permission} from './permissions_tree/types';

jest.mock('components/admin_console/permission_schemes_settings/permission_group', () => {
    return jest.fn(() => <div data-testid='permission-group'/>);
});

const PermissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');

describe('components/admin_console/permission_schemes_settings/permissions_tree_playbooks', () => {
    const defaultProps: ComponentProps<typeof PermissionsTreePlaybooks> = {
        role: {name: 'role'},
        parentRole: {},
        scope: 'scope',
        selectRow: () => null,
        readOnly: false,
        onToggle: () => null,
        license: {
        },
    };

    beforeEach(() => {
        PermissionGroup.mockClear();
    });

    describe('should show playbook permissions', () => {
        describe('for non-enterprise license', () => {
            ['', LicenseSkus.E10, LicenseSkus.Starter, LicenseSkus.Professional].forEach((licenseSku) => test(licenseSku, () => {
                const props = {
                    ...defaultProps,
                    license: {
                        isLicensed: licenseSku === '' ? 'false' : 'true',
                        SkuShortName: licenseSku,
                    },
                };

                renderWithContext(
                    <PermissionsTreePlaybooks {...props}/>,
                );

                const groups = PermissionGroup.mock.calls[0][0].permissions;
                expect(groups).toHaveLength(2);
                expect((groups[0] as Group | Permission).id).toStrictEqual('playbook_public');
                expect((groups[1] as Group | Permission).id).toStrictEqual('runs');
            }));
        });

        describe('for enterprise license', () => {
            [LicenseSkus.E20, LicenseSkus.Enterprise].forEach((licenseSku) => test(licenseSku, () => {
                const props = {
                    ...defaultProps,
                    license: {
                        isLicensed: 'true',
                        SkuShortName: licenseSku,
                    },
                };

                renderWithContext(
                    <PermissionsTreePlaybooks {...props}/>,
                );

                const groups = PermissionGroup.mock.calls[0][0].permissions;
                expect(groups).toHaveLength(3);
                expect((groups[0] as Group | Permission).id).toStrictEqual('playbook_public');
                expect((groups[1] as Group | Permission).id).toStrictEqual('playbook_private');
                expect((groups[2] as Group | Permission).id).toStrictEqual('runs');
            }));
        });
    });
});
