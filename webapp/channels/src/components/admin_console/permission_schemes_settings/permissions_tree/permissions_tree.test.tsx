// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PermissionGroup from 'components/admin_console/permission_schemes_settings/permission_group';
import PermissionsTree from 'components/admin_console/permission_schemes_settings/permissions_tree/permissions_tree';

import {LicenseSkus} from 'utils/constants';

import {Group, Permission} from './types';

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

    test('should match snapshot on default data', () => {
        const wrapper = shallow(
            <PermissionsTree {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on read only', () => {
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on team scope', () => {
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
                scope={'team_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on system scope', () => {
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on license without LDAPGroups', () => {
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
                license={{}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with parentRole with permissions', () => {
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
                parentRole={{permissions: ['invite_user']}}
                scope={'system_scope'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should ask to toggle on row toggle', () => {
        const onToggle = jest.fn();
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
                onToggle={onToggle}
            />,
        );
        wrapper.find(PermissionGroup).first().prop('onChange')(['test_permission', 'test_permission2']);
        expect(onToggle).toBeCalledWith('test', ['test_permission', 'test_permission2']);
    });

    test('should hide disabbled integration options', () => {
        const wrapper = shallow(
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
        expect(wrapper).toMatchSnapshot();
    });

    test('should map groups in the correct order', () => {
        const wrapper = shallow(
            <PermissionsTree
                {...defaultProps}
            />,
        );

        const groups = wrapper.find(PermissionGroup).first().prop('permissions') as Array<Group | Permission>;
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

                const wrapper = shallow(
                    <PermissionsTree
                        {...props}
                    />,
                );

                const groups = wrapper.find(PermissionGroup).first().prop('permissions') as Array<Group | Permission>;
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

                const wrapper = shallow(
                    <PermissionsTree
                        {...props}
                    />,
                );

                const groups = wrapper.find(PermissionGroup).first().prop('permissions') as Array<Group | Permission>;
                expect(groups[3].id).toStrictEqual('playbook_public');
                expect(groups[4].id).toStrictEqual('playbook_private');
                expect(groups[5].id).toStrictEqual('runs');
            }));
        });
    });
});
