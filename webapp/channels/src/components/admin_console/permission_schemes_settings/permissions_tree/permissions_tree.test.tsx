// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import GeneralConstants from 'mattermost-redux/constants/general';

import PermissionsTree from 'components/admin_console/permission_schemes_settings/permissions_tree/permissions_tree';

import {renderWithContext} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import type {} from './types';

// Mock the PermissionGroup component to help with testing
jest.mock('components/admin_console/permission_schemes_settings/permission_group', () => {
    return function MockPermissionGroup(props: any) {
        // Store the group permissions for testing
        (MockPermissionGroup as any).lastProps = props;
        return (
            <div
                data-testid={`permission-group-${props.id}`}
                data-permissions={JSON.stringify(props.permissions)}
                onClick={() => props.onChange?.(['test_permission', 'test_permission2'])}
            >
                {props.id}
            </div>
        );
    };
});

// Mock the Edit Post Time Limit components
jest.mock('components/admin_console/permission_schemes_settings/edit_post_time_limit_button', () => {
    return function MockEditPostTimeLimitButton() {
        return <button data-testid='edit-time-limit-button'>{'Edit'}</button>;
    };
});

jest.mock('components/admin_console/permission_schemes_settings/edit_post_time_limit_modal', () => {
    return function MockEditPostTimeLimitModal() {
        return <div data-testid='edit-time-limit-modal'>{'Modal'}</div>;
    };
});

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
        jest.clearAllMocks();
    });

    test('should render correctly with default props', () => {
        const {container} = renderWithContext(<PermissionsTree {...defaultProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should render correctly with read only flag', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render correctly with team scope', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                scope={'team_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render correctly with system scope', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render correctly with license without LDAPGroups', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                license={{}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render correctly with parentRole having permissions', () => {
        const {container} = renderWithContext(
            <PermissionsTree
                {...defaultProps}
                parentRole={{permissions: ['invite_user']}}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call onToggle when permission group changes', () => {
        const onToggle = jest.fn();
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                onToggle={onToggle}
            />,
        );

        // Find the permission group and click it to trigger the onChange
        const permissionGroup = screen.getByTestId('permission-group-all');
        userEvent.click(permissionGroup);

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

        // Access the PermissionGroup mock to get the permissions
        const permissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');

        // Check if the 'private_channel' group's permissions include 'convert_private_channel_to_public'
        if (shouldSeeConvertPrivateToPublic) {
            expect((permissionGroup as any).lastProps.permissions[2].permissions).toContain('convert_private_channel_to_public');
        } else {
            expect((permissionGroup as any).lastProps.permissions[2].permissions).not.toContain('convert_private_channel_to_public');
        }
    });

    test('should hide disabled integration options', () => {
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

    test('should present groups in the correct order', () => {
        renderWithContext(<PermissionsTree {...defaultProps}/>);

        // Access the PermissionGroup mock to get the permissions
        const permissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');
        const groups = (permissionGroup as any).lastProps.permissions;

        expect(groups[0].id).toBe('teams');
        expect(groups[6].id).toBe('posts');
        expect(groups[7].id).toBe('integrations');
        expect(groups[8].id).toBe('manage_shared_channels');
        expect(groups[9].id).toBe('custom_groups');
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

                renderWithContext(<PermissionsTree {...props}/>);

                // Access the PermissionGroup mock to get the permissions
                const permissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');
                const groups = (permissionGroup as any).lastProps.permissions;

                expect(groups[3].id).toBe('playbook_public');
                expect(groups[4].id).toBe('runs');
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

                renderWithContext(<PermissionsTree {...props}/>);

                // Access the PermissionGroup mock to get the permissions
                const permissionGroup = require('components/admin_console/permission_schemes_settings/permission_group');
                const groups = (permissionGroup as any).lastProps.permissions;

                expect(groups[3].id).toBe('playbook_public');
                expect(groups[4].id).toBe('playbook_private');
                expect(groups[5].id).toBe('runs');
            }));
        });
    });
});
