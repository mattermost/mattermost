// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GeneralConstants from 'mattermost-redux/constants/general';

import PermissionsTree from 'components/admin_console/permission_schemes_settings/permissions_tree/permissions_tree';

import {renderWithContext} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import type {Group, Permission} from './types';

jest.mock('components/admin_console/permission_schemes_settings/permission_group', () => {
    return jest.fn(() => <div data-testid='permission-group'/>);
});

jest.mock('components/admin_console/permission_schemes_settings/edit_post_time_limit_modal', () => {
    return jest.fn(() => null);
});

const PermissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');

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
        onToggle: jest.fn(),
        selectRow: jest.fn(),
        parentRole: undefined,
        readOnly: false,
        license: {
            LDAPGroups: 'true',
            isLicensed: 'true',
            SkuShortName: LicenseSkus.Enterprise,
        },
        customGroupsEnabled: true,
    };

    beforeEach(() => {
        PermissionGroup.mockClear();
    });

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
        const onToggle = jest.fn();
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                onToggle={onToggle}
            />,
        );
        const calls = PermissionGroup.mock.calls;
        const onChange = calls[0][0].onChange;
        onChange(['test_permission', 'test_permission2']);
        expect(onToggle).toHaveBeenCalledWith('test', ['test_permission', 'test_permission2']);
    });

    test.each([
        {roleName: GeneralConstants.SYSTEM_ADMIN_ROLE, shouldSeeConvertPrivateToPublic: true},
        {roleName: GeneralConstants.TEAM_ADMIN_ROLE, shouldSeeConvertPrivateToPublic: true},
        {roleName: GeneralConstants.CHANNEL_ADMIN_ROLE, shouldSeeConvertPrivateToPublic: false},
        {roleName: GeneralConstants.SYSTEM_USER_ROLE, shouldSeeConvertPrivateToPublic: false},
        {roleName: GeneralConstants.SYSTEM_GUEST_ROLE, shouldSeeConvertPrivateToPublic: false},
    ])('should show convert private channel to public for $roleName: $shouldSeeConvertPrivateToPublic', ({roleName, shouldSeeConvertPrivateToPublic}) => {
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                role={{name: roleName}}
            />,
        );
        const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
        if (shouldSeeConvertPrivateToPublic) {
            expect(groups[2].permissions).toContain('convert_private_channel_to_public');
        } else {
            expect(groups[2].permissions).not.toContain('convert_private_channel_to_public');
        }
    });

    test('should include edit_file_attachment in the posts permission group', () => {
        renderWithContext(
            <PermissionsTree {...defaultProps}/>,
        );

        const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
        const postsGroup = groups[6];
        expect(postsGroup.id).toBe('posts');
        expect(postsGroup.permissions).toContain('edit_file_attachment');
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
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
            />,
        );

        const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
        expect(groups[0].id).toStrictEqual('teams');
        expect(groups[6].id).toStrictEqual('posts');
        expect(groups[7].id).toStrictEqual('integrations');
        expect(groups[8].id).toStrictEqual('manage_shared_channels');
        expect(groups[9].id).toStrictEqual('custom_groups');
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
                    <PermissionsTree
                        {...props}
                    />,
                );

                const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
                expect(groups[3].id).toStrictEqual('playbook_public');
                expect(groups[4].id).toStrictEqual('runs');
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
                    <PermissionsTree
                        {...props}
                    />,
                );

                const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
                expect(groups[3].id).toStrictEqual('playbook_public');
                expect(groups[4].id).toStrictEqual('playbook_private');
                expect(groups[5].id).toStrictEqual('runs');
            }));
        });
    });

    describe('should show auto translation permissions', () => {
        describe('for non-enterprise-advanced license', () => {
            ['', LicenseSkus.E10, LicenseSkus.Starter, LicenseSkus.Professional, LicenseSkus.Enterprise, LicenseSkus.E20].forEach((licenseSku) => test(licenseSku, () => {
                const props = {
                    ...defaultProps,
                    license: {
                        isLicensed: licenseSku === '' ? 'false' : 'true',
                        SkuShortName: licenseSku,
                    },
                };

                renderWithContext(
                    <PermissionsTree
                        {...props}
                    />,
                );
                const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
                expect(groups[1].permissions).not.toContain('manage_public_channel_auto_translation');
                expect(groups[1].permissions).not.toContain('manage_private_channel_auto_translation');
                expect(groups[2].permissions).not.toContain('manage_public_channel_auto_translation');
                expect(groups[2].permissions).not.toContain('manage_private_channel_auto_translation');
            }));
        });

        describe('for enterprise-advanced license', () => {
            [LicenseSkus.Entry, LicenseSkus.EnterpriseAdvanced].forEach((licenseSku) => test(licenseSku, () => {
                const props = {
                    ...defaultProps,
                    license: {
                        isLicensed: 'true',
                        SkuShortName: licenseSku,
                    },
                };

                renderWithContext(
                    <PermissionsTree
                        {...props}
                    />,
                );
                const groups = PermissionGroup.mock.calls[0][0].permissions as Array<Group | Permission>;
                expect(groups[1].permissions).toContain('manage_public_channel_auto_translation');
                expect(groups[1].permissions).not.toContain('manage_private_channel_auto_translation');
                expect(groups[2].permissions).not.toContain('manage_public_channel_auto_translation');
                expect(groups[2].permissions).toContain('manage_private_channel_auto_translation');
            }));
        });
    });
});
