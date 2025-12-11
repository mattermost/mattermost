// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import PermissionsTreePlaybooks from 'components/admin_console/permission_schemes_settings/permissions_tree_playbooks';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {LicenseSkus} from 'utils/constants';

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

                const {container} = renderWithContext(
                    <PermissionsTreePlaybooks {...props}/>,
                );

                expect(container).toMatchSnapshot();
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

                const {container} = renderWithContext(
                    <PermissionsTreePlaybooks {...props}/>,
                );

                expect(container).toMatchSnapshot();
            }));
        });
    });
});
