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
});
