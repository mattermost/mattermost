// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelModeration as ChannelPermissions} from '@mattermost/types/channels';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';

import ChannelModeration from './channel_moderation';

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
            expect(within(screen.getByTestId('admin.channel.moderation.permission:create_post')).queryByTestId('admin.channel.moderation.permission.error:disabledGuests--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:create_post')).queryByTestId('admin.channel.moderation.permission.error:disabledMembers--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:create_post')).queryByTestId('admin.channel.moderation.permission.error:disabledBoth--text')).not.toBeInTheDocument();
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

            expect(within(screen.getByTestId('admin.channel.moderation.permission:create_post')).getByTestId('admin.channel.moderation.permission.error:disabledGuests--text')).toBeInTheDocument();
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

            expect(within(screen.getByTestId('admin.channel.moderation.permission:create_post')).getByTestId('admin.channel.moderation.permission.error:disabledMembers--text')).toBeInTheDocument();
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

            expect(within(screen.getByTestId('admin.channel.moderation.permission:create_post')).getByTestId('admin.channel.moderation.permission.error:disabledBoth--text')).toBeInTheDocument();
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

            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).queryByTestId('admin.channel.moderation.permission.error:disabledGuests--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).queryByTestId('admin.channel.moderation.permission.error:disabledMembers--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).queryByTestId('admin.channel.moderation.permission.error:disabledBoth--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).queryByTestId('admin.channel.moderation.permission.error:disabled_guests_due_to_create_posts--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).queryByTestId('admin.channel.moderation.permission.error:disabled_members_due_to_create_posts--text')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).queryByTestId('admin.channel.moderation.permission.error:disabled_both_due_to_create_posts--text')).not.toBeInTheDocument();
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
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).getByTestId('admin.channel.moderation.permission.error:disabled_guests_due_to_create_posts--text')).toBeInTheDocument();

            // Error 2: members disabled in scheme (members.enabled=false and createPostsKey is not 'disabledMembersDueToCreatePosts')
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).getByTestId('admin.channel.moderation.permission.error:disabledMembers--text')).toBeInTheDocument();
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
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).getByTestId('admin.channel.moderation.permission.error:disabled_both_due_to_create_posts--text')).toBeInTheDocument();
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
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).getByTestId('admin.channel.moderation.permission.error:disabled_members_due_to_create_posts--text')).toBeInTheDocument();

            // Error 2: guests disabled in scheme (guests.enabled=false and createPostsKey is not 'disabledGuestsDueToCreatePosts')
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).getByTestId('admin.channel.moderation.permission.error:disabledGuests--text')).toBeInTheDocument();
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
            expect(within(screen.getByTestId('admin.channel.moderation.permission:use_channel_mentions')).getByTestId('admin.channel.moderation.permission.error:disabledBoth--text')).toBeInTheDocument();
        });
    });
});
