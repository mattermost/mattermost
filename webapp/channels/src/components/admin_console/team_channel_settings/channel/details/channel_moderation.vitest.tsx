// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelModeration as ChannelPermissions} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import ChannelModeration, {ChannelModerationTableRow} from './channel_moderation';

describe('admin_console/team_channel_settings/channel/ChannelModeration', () => {
    const channelPermissions: ChannelPermissions[] = [{
        name: 'create_post',
        roles: {
            guests: {
                value: true,
                enabled: true,
            },
            members: {
                value: true,
                enabled: true,
            },
            admins: {
                value: true,
                enabled: true,
            },
        },
    }];
    const onChannelPermissionsChanged = vi.fn();
    const teamSchemeID = 'id';
    const teamSchemeDisplayName = 'dp';

    test('Should match first Snapshot', () => {
        const {container} = renderWithContext(
            <ChannelModeration
                channelPermissions={channelPermissions}
                onChannelPermissionsChanged={onChannelPermissionsChanged}
                teamSchemeID={teamSchemeID}
                teamSchemeDisplayName={teamSchemeDisplayName}
                guestAccountsEnabled={true}
                readOnly={false}
                isPublic={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match second Snapshot', () => {
        const {container} = renderWithContext(
            <table>
                <tbody>
                    <ChannelModerationTableRow
                        key={channelPermissions[0].name}
                        name={channelPermissions[0].name}
                        guests={channelPermissions[0].roles.guests?.value}
                        guestsDisabled={!channelPermissions[0].roles.guests?.enabled}
                        members={channelPermissions[0].roles.members.value}
                        membersDisabled={!channelPermissions[0].roles.members.enabled}
                        onClick={onChannelPermissionsChanged}
                        errorMessages={[]}
                        guestAccountsEnabled={true}
                    />
                </tbody>
            </table>,
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match third Snapshot', () => {
        const channelPermissionsCustom: ChannelPermissions[] = [
            {
                name: 'create_post',
                roles: {
                    guests: {
                        value: true,
                        enabled: true,
                    },
                    members: {
                        value: false,
                        enabled: true,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
            {
                name: 'use_channel_mentions',
                roles: {
                    guests: {
                        value: false,
                        enabled: false,
                    },
                    members: {
                        value: false,
                        enabled: false,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
        ];
        const {container} = renderWithContext(
            <ChannelModeration
                channelPermissions={channelPermissionsCustom}
                onChannelPermissionsChanged={onChannelPermissionsChanged}
                teamSchemeID={teamSchemeID}
                teamSchemeDisplayName={teamSchemeDisplayName}
                guestAccountsEnabled={true}
                isPublic={true}
                readOnly={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match fourth Snapshot', () => {
        const channelPermissionsCustom: ChannelPermissions[] = [
            {
                name: 'create_post',
                roles: {
                    guests: {
                        value: false,
                        enabled: true,
                    },
                    members: {
                        value: false,
                        enabled: true,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
            {
                name: 'use_channel_mentions',
                roles: {
                    guests: {
                        value: false,
                        enabled: false,
                    },
                    members: {
                        value: false,
                        enabled: false,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
        ];
        const {container} = renderWithContext(
            <ChannelModeration
                channelPermissions={channelPermissionsCustom}
                onChannelPermissionsChanged={onChannelPermissionsChanged}
                teamSchemeID={teamSchemeID}
                teamSchemeDisplayName={teamSchemeDisplayName}
                guestAccountsEnabled={true}
                isPublic={false}
                readOnly={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match fifth Snapshot', () => {
        const channelPermissionsCustom: ChannelPermissions[] = [
            {
                name: 'create_post',
                roles: {
                    guests: {
                        value: true,
                        enabled: true,
                    },
                    members: {
                        value: true,
                        enabled: true,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
            {
                name: 'use_channel_mentions',
                roles: {
                    guests: {
                        value: false,
                        enabled: false,
                    },
                    members: {
                        value: false,
                        enabled: false,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
        ];
        const {container} = renderWithContext(
            <ChannelModeration
                channelPermissions={channelPermissionsCustom}
                onChannelPermissionsChanged={onChannelPermissionsChanged}
                teamSchemeID={teamSchemeID}
                teamSchemeDisplayName={teamSchemeDisplayName}
                guestAccountsEnabled={true}
                isPublic={true}
                readOnly={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match sixth Snapshot', () => {
        const channelPermissionsCustom: ChannelPermissions[] = [
            {
                name: 'create_post',
                roles: {
                    guests: {
                        value: false,
                        enabled: true,
                    },
                    members: {
                        value: true,
                        enabled: true,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
            {
                name: 'use_channel_mentions',
                roles: {
                    guests: {
                        value: false,
                        enabled: false,
                    },
                    members: {
                        value: false,
                        enabled: false,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            },
        ];
        const {container} = renderWithContext(
            <ChannelModeration
                channelPermissions={channelPermissionsCustom}
                onChannelPermissionsChanged={onChannelPermissionsChanged}
                teamSchemeID={teamSchemeID}
                teamSchemeDisplayName={teamSchemeDisplayName}
                guestAccountsEnabled={true}
                isPublic={false}
                readOnly={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    // Second "Should match sixth Snapshot" test - no team scheme
    test('Should match sixth Snapshot', () => {
        const {container} = renderWithContext(
            <ChannelModeration
                channelPermissions={channelPermissions}
                onChannelPermissionsChanged={onChannelPermissionsChanged}
                teamSchemeID={undefined}
                teamSchemeDisplayName={undefined}
                guestAccountsEnabled={false}
                isPublic={false}
                readOnly={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match seventh Snapshot', () => {
        const {container} = renderWithContext(
            <table>
                <tbody>
                    <ChannelModerationTableRow
                        key={channelPermissions[0].name}
                        name={channelPermissions[0].name}
                        guests={channelPermissions[0].roles.guests?.value}
                        guestsDisabled={!channelPermissions[0].roles.guests?.enabled}
                        members={channelPermissions[0].roles.members.value}
                        membersDisabled={!channelPermissions[0].roles.members.enabled}
                        onClick={onChannelPermissionsChanged}
                        errorMessages={[]}
                        guestAccountsEnabled={false}
                    />
                </tbody>
            </table>,
        );
        expect(container).toMatchSnapshot();
    });

    describe('errorMessages function', () => {
        test('Should not return any error messages', () => {
            // When all permissions are enabled, no error messages should be displayed
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissions}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );

            // No error messages should be rendered
            expect(container.querySelectorAll('.error-message').length).toBe(0);
        });

        test('Should return error message when create_post guests disabled', () => {
            const permissionsWithGuestsDisabled: ChannelPermissions[] = [{
                name: 'create_post',
                roles: {
                    guests: {
                        value: true,
                        enabled: false,
                    },
                    members: {
                        value: true,
                        enabled: true,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            }];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={permissionsWithGuestsDisabled}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );

            // Component should render with error state
            expect(container).toMatchSnapshot();
        });

        test('Should return error message when create_post members disabled', () => {
            const permissionsWithMembersDisabled: ChannelPermissions[] = [{
                name: 'create_post',
                roles: {
                    guests: {
                        value: true,
                        enabled: true,
                    },
                    members: {
                        value: true,
                        enabled: false,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            }];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={permissionsWithMembersDisabled}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        test('Should return 1 error message when create_post members and guests disabled', () => {
            const permissionsWithBothDisabled: ChannelPermissions[] = [{
                name: 'create_post',
                roles: {
                    guests: {
                        value: true,
                        enabled: false,
                    },
                    members: {
                        value: true,
                        enabled: false,
                    },
                    admins: {
                        value: true,
                        enabled: true,
                    },
                },
            }];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={permissionsWithBothDisabled}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        test('Should return not error messages for use_channel_mentions', () => {
            const channelPermissionsCustom: ChannelPermissions[] = [
                {
                    name: 'create_post',
                    roles: {
                        guests: {
                            value: true,
                            enabled: true,
                        },
                        members: {
                            value: true,
                            enabled: true,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
                {
                    name: 'use_channel_mentions',
                    roles: {
                        guests: {
                            value: true,
                            enabled: true,
                        },
                        members: {
                            value: true,
                            enabled: true,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
            ];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsCustom}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        test('Should return 2 error messages for use_channel_mentions', () => {
            const channelPermissionsCustom: ChannelPermissions[] = [
                {
                    name: 'create_post',
                    roles: {
                        guests: {
                            value: false,
                            enabled: true,
                        },
                        members: {
                            value: true,
                            enabled: true,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
                {
                    name: 'use_channel_mentions',
                    roles: {
                        guests: {
                            value: false,
                            enabled: false,
                        },
                        members: {
                            value: true,
                            enabled: false,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
            ];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsCustom}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        test('Should return 1 error messages for use_channel_mentions', () => {
            const channelPermissionsCustom: ChannelPermissions[] = [
                {
                    name: 'create_post',
                    roles: {
                        guests: {
                            value: false,
                            enabled: true,
                        },
                        members: {
                            value: false,
                            enabled: true,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
                {
                    name: 'use_channel_mentions',
                    roles: {
                        guests: {
                            value: false,
                            enabled: false,
                        },
                        members: {
                            value: false,
                            enabled: false,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
            ];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsCustom}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={true}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        // Second test with same title - different scenario
        test('Should return 2 error messages for use_channel_mentions', () => {
            const channelPermissionsCustom: ChannelPermissions[] = [
                {
                    name: 'create_post',
                    roles: {
                        guests: {
                            value: true,
                            enabled: true,
                        },
                        members: {
                            value: false,
                            enabled: true,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
                {
                    name: 'use_channel_mentions',
                    roles: {
                        guests: {
                            value: false,
                            enabled: false,
                        },
                        members: {
                            value: false,
                            enabled: false,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
            ];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsCustom}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={true}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        test('Should return 1 error messages for use_channel_mention when create_posts is checked and use_channel_mentions is disabled', () => {
            const channelPermissionsCustom: ChannelPermissions[] = [
                {
                    name: 'create_post',
                    roles: {
                        guests: {
                            value: true,
                            enabled: true,
                        },
                        members: {
                            value: true,
                            enabled: true,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
                {
                    name: 'use_channel_mentions',
                    roles: {
                        guests: {
                            value: false,
                            enabled: false,
                        },
                        members: {
                            value: false,
                            enabled: false,
                        },
                        admins: {
                            value: true,
                            enabled: true,
                        },
                    },
                },
            ];
            const {container} = renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsCustom}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={true}
                    readOnly={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });
    });
});
