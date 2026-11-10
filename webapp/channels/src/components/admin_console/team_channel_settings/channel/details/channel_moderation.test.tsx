// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelModeration as ChannelPermissions} from '@mattermost/types/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';

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
    const onChannelPermissionsChanged = jest.fn();
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
                        name={channelPermissions[0].name}
                        guests={channelPermissions[0].roles.guests?.value}
                        guestsDisabled={!channelPermissions[0].roles.guests?.enabled}
                        members={channelPermissions[0].roles.members.value}
                        membersDisabled={!channelPermissions[0].roles.members.enabled}
                        onClick={onChannelPermissionsChanged}
                        errorMessages={null}
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

    test('Should match snapshot with create_post guests off and members on, private channel', () => {
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

    test('Should match snapshot with no team scheme and guest accounts disabled', () => {
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

    test('Should match snapshot for ChannelModerationTableRow with guest accounts disabled', () => {
        const {container} = renderWithContext(
            <table>
                <tbody>
                    <ChannelModerationTableRow
                        name={channelPermissions[0].name}
                        guests={channelPermissions[0].roles.guests?.value}
                        guestsDisabled={!channelPermissions[0].roles.guests?.enabled}
                        members={channelPermissions[0].roles.members.value}
                        membersDisabled={!channelPermissions[0].roles.members.enabled}
                        onClick={onChannelPermissionsChanged}
                        errorMessages={null}
                        guestAccountsEnabled={false}
                    />
                </tbody>
            </table>,
        );
        expect(container).toMatchSnapshot();
    });

    describe('errorMessages function', () => {
        test('Should not return any error messages', () => {
            renderWithContext(
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

            // No error messages should be present for create_post when all roles are enabled
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-createPosts-disabledGuest')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-createPosts-disabledMember')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-createPosts-disabledBoth')).not.toBeInTheDocument();
        });

        test('Should return error message when create_post guests disabled', () => {
            const channelPermissionsWithGuestsDisabled: ChannelPermissions[] = [{
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

            renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsWithGuestsDisabled}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );

            expect(screen.getByTestId('admin-channel_settings-channel_moderation-createPosts-disabledGuest')).toBeInTheDocument();
        });

        test('Should return error message when create_post members disabled', () => {
            const channelPermissionsWithMembersDisabled: ChannelPermissions[] = [{
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

            renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsWithMembersDisabled}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );

            expect(screen.getByTestId('admin-channel_settings-channel_moderation-createPosts-disabledMember')).toBeInTheDocument();
        });

        test('Should return 1 error message when create_post members and guests disabled', () => {
            const channelPermissionsWithBothDisabled: ChannelPermissions[] = [{
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

            renderWithContext(
                <ChannelModeration
                    channelPermissions={channelPermissionsWithBothDisabled}
                    onChannelPermissionsChanged={onChannelPermissionsChanged}
                    teamSchemeID={teamSchemeID}
                    teamSchemeDisplayName={teamSchemeDisplayName}
                    guestAccountsEnabled={true}
                    isPublic={false}
                    readOnly={false}
                />,
            );

            expect(screen.getByTestId('admin-channel_settings-channel_moderation-createPosts-disabledBoth')).toBeInTheDocument();
        });

        test('Should not return error messages for use_channel_mentions', () => {
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

            renderWithContext(
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

            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledGuest')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledMember')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledBoth')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledGuestsDueToCreatePosts')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledMemberDueToCreatePosts')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledBothDueToCreatePosts')).not.toBeInTheDocument();
        });

        test('Should return 2 error messages for use_channel_mentions when guests blocked by create_post and members disabled in scheme', () => {
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

            renderWithContext(
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

            // Error 1: guests can't use channel mentions because create_post guests value is false
            expect(screen.getByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledGuestsDueToCreatePosts')).toBeInTheDocument();

            // Error 2: members disabled in scheme (members.enabled=false and createPostsKey is not 'disabledMembersDueToCreatePosts')
            expect(screen.getByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledMember')).toBeInTheDocument();
        });

        test('Should return 1 error message for use_channel_mentions when both create_post off, public channel', () => {
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

            renderWithContext(
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

            // Both create_post values are false, so only disabledBothDueToCreatePosts is shown (returns early)
            expect(screen.getByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledBothDueToCreatePosts')).toBeInTheDocument();
        });

        test('Should return 2 error messages for use_channel_mentions when members blocked by create_post and guests disabled in scheme', () => {
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

            renderWithContext(
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

            // Error 1: members can't use channel mentions because create_post members value is false
            expect(screen.getByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledMemberDueToCreatePosts')).toBeInTheDocument();

            // Error 2: guests disabled in scheme (guests.enabled=false and createPostsKey is not 'disabledGuestsDueToCreatePosts')
            expect(screen.getByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledGuest')).toBeInTheDocument();
        });

        test('Should return 1 error message for use_channel_mention when create_posts is checked and use_channel_mentions is disabled', () => {
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

            renderWithContext(
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

            // Both guests and members are disabled in scheme, and no createPosts errors, so disabledBoth is shown
            expect(screen.getByTestId('admin-channel_settings-channel_moderation-channelMentions-disabledBoth')).toBeInTheDocument();
        });
    });
});
