// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionsTree from 'components/admin_console/permission_schemes_settings/permissions_tree/permissions_tree';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {LicenseSkus} from 'utils/constants';

describe('components/admin_console/permission_schemes_settings/permission_tree', () => {
    const defaultProps = {
        scope: 'channel_scope',
        config: {
            EnableIncomingWebhooks: 'true',
            EnableOutgoingWebhooks: 'true',
            EnableOAuthServiceProvider: 'true',
            EnableCommands: 'true',
            EnableCustomEmoji: 'true',
        },
        role: {
            name: 'test',
            permissions: [],
        },
        onToggle: vi.fn(),
        selectRow: vi.fn(),
        parentRole: undefined,
        readOnly: false,
        license: {
            LDAPGroups: 'true',
            isLicensed: 'true',
            SkuShortName: LicenseSkus.Enterprise,
        },
        customGroupsEnabled: true,
    };

    test('should match snapshot on default data', () => {
        const {container} = renderWithContext(
            <PermissionsTree {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on read only', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on team scope', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                scope={'team_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on system scope', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on license without LDAPGroups', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                license={{}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with parentRole with permissions', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                parentRole={{permissions: ['invite_user']}}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should ask to toggle on row toggle', () => {
        const {container} = renderWithContext(
            <PermissionsTree {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show convert private channel to public for $roleName: $shouldSeeConvertPrivateToPublic', () => {
        const {container} = renderWithContext(
            <PermissionsTree {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should hide disabbled integration options', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                config={{
                    EnableIncomingWebhooks: 'false',
                    EnableOutgoingWebhooks: 'false',
                    EnableCommands: 'false',
                    EnableCustomEmoji: 'false',
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should map groups in the correct order', () => {
        const {container} = renderWithContext(
            <PermissionsTree {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
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

                const {container} = renderWithContext(
                    <PermissionsTree {...props}/>,
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
                    <PermissionsTree {...props}/>,
                );

                expect(container).toMatchSnapshot();
            }));
        });
    });
});
