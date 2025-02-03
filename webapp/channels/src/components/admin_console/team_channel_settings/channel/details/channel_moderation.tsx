// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import isNil from 'lodash/isNil';
import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {ChannelModeration as ChannelPermissions} from '@mattermost/types/channels';

import {Permissions, Roles} from 'mattermost-redux/constants';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';

import type {ChannelModerationRoles} from './types';

const PERIOD_TO_SLASH_REGEX = /\./g;

const MEMBERS_CAN_CREATE_POST_PERMISSION = 'create_post';
const GUESTS_CAN_CREATE_POST_PERMISSION = 'guest_create_post';
const MEMBERS_CAN_POST_REACTIONS_PERMISSION = 'reactions';
const GUESTS_CAN_POST_REACTIONS_PERMISSION = 'guest_reactions';
const MEMBERS_CAN_MANAGE_CHANNEL_MEMBERS_PERMISSION = 'manage_{public_or_private}_channel_members';
const GUESTS_CAN_MANAGE_CHANNEL_MEMBERS_PERMISSION = 'guest_manage_{public_or_private}_channel_members';
const MEMBERS_CAN_USE_CHANNEL_MENTIONS_PERMISSION = 'use_channel_mentions';
const GUESTS_CAN_USE_CHANNEL_MENTIONS_PERMISSION = 'guest_use_channel_mentions';
const MEMBERS_CAN_MANAGE_CHANNEL_BOOKMARKS_PERMISSION = 'manage_{public_or_private}_channel_bookmarks';
const GUESTS_CAN_MANAGE_CHANNEL_BOOKMARKS_PERMISSION = 'guest_manage_{public_or_private}_channel_bookmarks';

function getChannelModerationPermissionNames(permission: string) {
    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST) {
        return {
            disabledGuests: GUESTS_CAN_CREATE_POST_PERMISSION,
            disabledMembers: MEMBERS_CAN_CREATE_POST_PERMISSION,
            disabledBoth: MEMBERS_CAN_CREATE_POST_PERMISSION,
        };
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_REACTIONS) {
        return {
            disabledGuests: GUESTS_CAN_POST_REACTIONS_PERMISSION,
            disabledMembers: MEMBERS_CAN_POST_REACTIONS_PERMISSION,
            disabledBoth: MEMBERS_CAN_POST_REACTIONS_PERMISSION,
        };
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_MEMBERS) {
        return {
            disabledGuests: GUESTS_CAN_MANAGE_CHANNEL_MEMBERS_PERMISSION,
            disabledMembers: MEMBERS_CAN_MANAGE_CHANNEL_MEMBERS_PERMISSION,
            disabledBoth: MEMBERS_CAN_MANAGE_CHANNEL_MEMBERS_PERMISSION,
        };
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS) {
        return {
            disabledGuests: GUESTS_CAN_USE_CHANNEL_MENTIONS_PERMISSION,
            disabledMembers: MEMBERS_CAN_USE_CHANNEL_MENTIONS_PERMISSION,
            disabledBoth: MEMBERS_CAN_USE_CHANNEL_MENTIONS_PERMISSION,
        };
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_BOOKMARKS) {
        return {
            disabledGuests: GUESTS_CAN_MANAGE_CHANNEL_BOOKMARKS_PERMISSION,
            disabledMembers: MEMBERS_CAN_MANAGE_CHANNEL_BOOKMARKS_PERMISSION,
            disabledBoth: MEMBERS_CAN_MANAGE_CHANNEL_BOOKMARKS_PERMISSION,
        };
    }

    return null;
}

function getChannelModerationRowsMessages(permission: string): Record<string, MessageDescriptor> | null {
    const createPostRowMessages = defineMessages({
        title: {
            id: 'admin.channel_settings.channel_moderation.createPosts',
            defaultMessage: 'Create Posts',
        },
        description: {
            id: 'admin.channel_settings.channel_moderation.createPostsDesc',
            defaultMessage: 'The ability for members and guests to create posts in the channel.',
        },
        descriptionMembers: {
            id: 'admin.channel_settings.channel_moderation.createPostsDescMembers',
            defaultMessage: 'The ability for members to create posts in the channel.',
        },
        disabledGuests: {
            id: 'admin.channel_settings.channel_moderation.createPosts.disabledGuest',
            defaultMessage: 'Create posts for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledMembers: {
            id: 'admin.channel_settings.channel_moderation.createPosts.disabledMember',
            defaultMessage: 'Create posts for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledBoth: {
            id: 'admin.channel_settings.channel_moderation.createPosts.disabledBoth',
            defaultMessage: 'Create posts for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
    });

    const postReactionsRowMessages = defineMessages({
        title: {
            id: 'admin.channel_settings.channel_moderation.postReactions',
            defaultMessage: 'Post Reactions',
        },
        description: {
            id: 'admin.channel_settings.channel_moderation.postReactionsDesc',
            defaultMessage: 'The ability for members and guests to post reactions.',
        },
        descriptionMembers: {
            id: 'admin.channel_settings.channel_moderation.postReactionsDescMembers',
            defaultMessage: 'The ability for members to post reactions.',
        },
        disabledGuests: {
            id: 'admin.channel_settings.channel_moderation.postReactions.disabledGuest',
            defaultMessage: 'Post reactions for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledMembers: {
            id: 'admin.channel_settings.channel_moderation.postReactions.disabledMember',
            defaultMessage: 'Post reactions for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledBoth: {
            id: 'admin.channel_settings.channel_moderation.postReactions.disabledBoth',
            defaultMessage: 'Post reactions for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
    });

    const manageMembersRowMessages = defineMessages({
        title: {
            id: 'admin.channel_settings.channel_moderation.manageMembers',
            defaultMessage: 'Manage Members',
        },
        description: {
            id: 'admin.channel_settings.channel_moderation.manageMembersDesc',
            defaultMessage: 'The ability for members to add and remove people.',
        },
        disabledGuests: {
            id: 'admin.channel_settings.channel_moderation.manageMembers.disabledGuest',
            defaultMessage: 'Manage members for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledMembers: {
            id: 'admin.channel_settings.channel_moderation.manageMembers.disabledMember',
            defaultMessage: 'Manage members for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledBoth: {
            id: 'admin.channel_settings.channel_moderation.manageMembers.disabledBoth',
            defaultMessage: 'Manage members for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
    });

    const channelMentionsRowMessages = defineMessages({
        title: {
            id: 'admin.channel_settings.channel_moderation.channelMentions',
            defaultMessage: 'Channel Mentions',
        },
        description: {
            id: 'admin.channel_settings.channel_moderation.channelMentionsDesc',
            defaultMessage: 'The ability for members and guests to use @all, @here and @channel.',
        },
        descriptionMembers: {
            id: 'admin.channel_settings.channel_moderation.channelMentionsDescMembers',
            defaultMessage: 'The ability for members to use @all, @here and @channel.',
        },
        disabledGuests: {
            id: 'admin.channel_settings.channel_moderation.channelMentions.disabledGuest',
            defaultMessage: 'Channel mentions for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledMembers: {
            id: 'admin.channel_settings.channel_moderation.channelMentions.disabledMember',
            defaultMessage: 'Channel mentions for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledBoth: {
            id: 'admin.channel_settings.channel_moderation.channelMentions.disabledBoth',
            defaultMessage: 'Channel mentions for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledGuestsDueToCreatePosts: {
            id: 'admin.channel_settings.channel_moderation.channelMentions.disabledGuestsDueToCreatePosts',
            defaultMessage: 'Guests can not use channel mentions without the ability to create posts.',
        },
        disabledMembersDueToCreatePosts: {
            id: 'admin.channel_settings.channel_moderation.channelMentions.disabledMemberDueToCreatePosts',
            defaultMessage: 'Members can not use channel mentions without the ability to create posts.',
        },
        disabledBothDueToCreatePosts: {
            id: 'admin.channel_settings.channel_moderation.channelMentions.disabledBothDueToCreatePosts',
            defaultMessage: 'Guests and members can not use channel mentions without the ability to create posts.',
        },
    });

    const manageBookmarksRowMessages = defineMessages({
        title: {
            id: 'admin.channel_settings.channel_moderation.manageBookmarks',
            defaultMessage: 'Manage Bookmarks',
        },
        description: {
            id: 'admin.channel_settings.channel_moderation.manageBookmarksDesc',
            defaultMessage: 'The ability for members and guests to add, delete and sort bookmarks.',
        },
        disabledGuests: {
            id: 'admin.channel_settings.channel_moderation.manageBookmarks.disabledGuest',
            defaultMessage: 'Manage bookmarks for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledMembers: {
            id: 'admin.channel_settings.channel_moderation.manageBookmarks.disabledMember',
            defaultMessage: 'Manage bookmarks for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
        disabledBoth: {
            id: 'admin.channel_settings.channel_moderation.manageBookmarks.disabledBoth',
            defaultMessage: 'Manage bookmarks for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
        },
    });

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST) {
        return createPostRowMessages;
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_REACTIONS) {
        return postReactionsRowMessages;
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_MEMBERS) {
        return manageMembersRowMessages;
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS) {
        return channelMentionsRowMessages;
    }

    if (permission === Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_BOOKMARKS) {
        return manageBookmarksRowMessages;
    }

    return null;
}

const channelModerationHeaderMessages = defineMessages({
    titleMessage: {
        id: 'admin.channel_settings.channel_moderation.title',
        defaultMessage: 'Advanced Access Control',
    },
    subtitleMessageForMembersAndGuests: {
        id: 'admin.channel_settings.channel_moderation.subtitle',
        defaultMessage: 'Manage the actions available to channel members and guests.',
    },
    subtitleMessageForMembers: {
        id: 'admin.channel_settings.channel_moderation.subtitleMembers',
        defaultMessage: 'Manage the actions available to channel members.',
    },
});

interface ChannelModerationTableRow {
    name: string;
    guests?: boolean;
    members: boolean;
    guestsDisabled?: boolean;
    membersDisabled: boolean;
    onClick: (name: string, channelRole: ChannelModerationRoles) => void;
    errorMessages?: any;
    guestAccountsEnabled: boolean;
    readOnly?: boolean;
}

export const ChannelModerationTableRow = (props: ChannelModerationTableRow) => {
    const channelModerationPermissionMessages = getChannelModerationRowsMessages(props.name);
    let descriptionId = channelModerationPermissionMessages?.description.id;
    let descriptionDefaultMessage = channelModerationPermissionMessages?.description.defaultMessage;
    if (!props.guestAccountsEnabled && channelModerationPermissionMessages?.descriptionMembers) {
        descriptionId = channelModerationPermissionMessages.descriptionMembers?.id ?? '';
        descriptionDefaultMessage = channelModerationPermissionMessages?.descriptionMembers?.defaultMessage ?? '';
    }
    return (
        <tr>
            <td>
                <div
                    className='as-bs-label'
                    data-testid={channelModerationPermissionMessages?.title?.id?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                >
                    <FormattedMessage
                        id={channelModerationPermissionMessages?.title?.id}
                        defaultMessage={channelModerationPermissionMessages?.title?.defaultMessage}
                    />
                </div>
                <div
                    data-testid={channelModerationPermissionMessages?.description?.id?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                >
                    <FormattedMessage
                        id={descriptionId}
                        defaultMessage={descriptionDefaultMessage}
                    />
                </div>
                {props.errorMessages}
            </td>
            {props.guestAccountsEnabled &&
                <td>
                    {!isNil(props.guests) &&
                        <button
                            type='button'
                            data-testid={`${props.name}-${Roles.GUESTS}`}
                            className={classNames(
                                'checkbox',
                                {
                                    checked: props.guests && !props.guestsDisabled,
                                    disabled: props.guestsDisabled,
                                },
                            )}
                            onClick={() => props.onClick(props.name, Roles.GUESTS as ChannelModerationRoles)}
                            disabled={props.guestsDisabled || props.readOnly}
                        >
                            {props.guests && !props.guestsDisabled && <CheckboxCheckedIcon/>}
                        </button>
                    }
                </td>
            }
            <td>
                {!isNil(props.members) &&
                    <button
                        type='button'
                        data-testid={`${props.name}-${Roles.MEMBERS}`}
                        className={classNames(
                            'checkbox',
                            {
                                checked: props.members && !props.membersDisabled,
                                disabled: props.membersDisabled,
                            },
                        )}
                        onClick={() => props.onClick(props.name, Roles.MEMBERS as ChannelModerationRoles)}
                        disabled={props.membersDisabled || props.readOnly}
                    >
                        {props.members && !props.membersDisabled && <CheckboxCheckedIcon/>}
                    </button>
                }
            </td>
        </tr>
    );
};

interface Props {
    channelPermissions?: ChannelPermissions[];
    onChannelPermissionsChanged: (name: string, channelRole: ChannelModerationRoles) => void;
    teamSchemeID?: string;
    teamSchemeDisplayName?: string;
    guestAccountsEnabled: boolean;
    isPublic: boolean;
    readOnly?: boolean;
}

export default class ChannelModeration extends React.PureComponent<Props> {
    private errorMessagesToDisplay = (entry: ChannelPermissions): JSX.Element[] => {
        const channelModerationPermissionMessages = getChannelModerationRowsMessages(entry.name);

        const errorMessages: JSX.Element[] = [];
        const isGuestsDisabled = !isNil(entry.roles.guests?.enabled) && !entry.roles.guests?.enabled && this.props.guestAccountsEnabled;
        const isMembersDisabled = !entry.roles.members.enabled;
        let createPostsKey = '';
        if (entry.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS) {
            const createPostsObject = this.props.channelPermissions && this.props.channelPermissions!.find((permission) => permission.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST);
            if (!createPostsObject!.roles.guests!.value && this.props.guestAccountsEnabled && !createPostsObject!.roles.members!.value) {
                errorMessages.push(
                    <div
                        data-testid={channelModerationPermissionMessages?.disabledBothDueToCreatePosts?.id?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                        key={channelModerationPermissionMessages?.disabledBothDueToCreatePosts?.id}
                    >
                        <FormattedMessage
                            id={channelModerationPermissionMessages?.disabledBothDueToCreatePosts?.id}
                            defaultMessage={channelModerationPermissionMessages?.disabledBothDueToCreatePosts?.defaultMessage}
                        />
                    </div>,
                );
                return errorMessages;
            } else if (!createPostsObject!.roles.guests!.value && this.props.guestAccountsEnabled) {
                createPostsKey = 'disabledGuestsDueToCreatePosts';
                errorMessages.push(
                    <div
                        data-testid={channelModerationPermissionMessages?.disabledGuestsDueToCreatePosts?.id?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                        key={channelModerationPermissionMessages?.disabledGuestsDueToCreatePosts?.id}
                    >
                        <FormattedMessage
                            id={channelModerationPermissionMessages?.disabledGuestsDueToCreatePosts?.id}
                            defaultMessage={channelModerationPermissionMessages?.disabledGuestsDueToCreatePosts?.defaultMessage}
                        />
                    </div>,
                );
            } else if (!createPostsObject!.roles.members!.value) {
                createPostsKey = 'disabledMembersDueToCreatePosts';
                errorMessages.push(
                    <div
                        data-testid={channelModerationPermissionMessages?.disabledMembersDueToCreatePosts?.id?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                        key={channelModerationPermissionMessages?.disabledMembersDueToCreatePosts?.id}
                    >
                        <FormattedMessage
                            id={channelModerationPermissionMessages?.disabledMembersDueToCreatePosts?.id}
                            defaultMessage={channelModerationPermissionMessages?.disabledMembersDueToCreatePosts?.defaultMessage}
                        />
                    </div>,
                );
            }
        }

        let disabledKey;
        let disabledKeyId;
        let disabledKeyMessage;
        let schemeName = 'System Scheme';
        let schemeLink = 'system_scheme';

        if (this.props.teamSchemeID) {
            schemeName = this.props?.teamSchemeDisplayName + ' Team Scheme';
            schemeLink = `team_override_scheme/${this.props.teamSchemeID}`;
        }

        const permissionName = getChannelModerationPermissionNames(entry.name);

        if (isGuestsDisabled && isMembersDisabled && errorMessages.length <= 0) {
            disabledKey = 'disabledBoth';
            if (permissionName?.disabledBoth) {
                schemeLink += `?rowIdFromQuery=${permissionName.disabledBoth}`;
                if (schemeLink.includes('{public_or_private}')) {
                    const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
                    schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
                }
            }
            disabledKeyId = channelModerationPermissionMessages?.disabledBoth?.id;
            disabledKeyMessage = channelModerationPermissionMessages?.disabledBoth?.defaultMessage;
        } else if (isGuestsDisabled && createPostsKey !== 'disabledGuestsDueToCreatePosts') {
            disabledKey = 'disabledGuests';
            if (permissionName?.disabledGuests) {
                schemeLink += `?rowIdFromQuery=${permissionName.disabledGuests}`;
                if (schemeLink.includes('{public_or_private}')) {
                    const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
                    schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
                }
            }
            disabledKeyId = channelModerationPermissionMessages?.disabledGuests?.id;
            disabledKeyMessage = channelModerationPermissionMessages?.disabledGuests?.defaultMessage;
        } else if (isMembersDisabled && createPostsKey !== 'disabledMembersDueToCreatePosts') {
            disabledKey = 'disabledMembers';
            if (permissionName?.disabledMembers) {
                schemeLink += `?rowIdFromQuery=${permissionName.disabledMembers}`;
                if (schemeLink.includes('{public_or_private}')) {
                    const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
                    schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
                }
            }
            disabledKeyId = channelModerationPermissionMessages?.disabledMembers?.id;
            disabledKeyMessage = channelModerationPermissionMessages?.disabledMembers?.defaultMessage;
        }

        if (schemeLink.includes('{public_or_private}')) {
            const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
            schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
        }

        if (disabledKey) {
            errorMessages.push(
                <div
                    data-testid={disabledKeyId?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                    key={disabledKeyId}
                >
                    <FormattedMarkdownMessage
                        id={disabledKeyId}
                        defaultMessage={disabledKeyMessage as string}
                        values={{
                            scheme_name: schemeName,
                            scheme_link: schemeLink,
                        }}
                    />
                </div>,
            );
        }
        return errorMessages;
    };

    render = (): JSX.Element => {
        const {channelPermissions, guestAccountsEnabled, onChannelPermissionsChanged, readOnly} = this.props;
        return (
            <AdminPanel
                id='channel_moderation'
                title={channelModerationHeaderMessages.titleMessage}
                subtitle={
                    guestAccountsEnabled ?
                        channelModerationHeaderMessages.subtitleMessageForMembersAndGuests :
                        channelModerationHeaderMessages.subtitleMessageForMembers
                }
            >
                <div className='channel-moderation'>
                    <div className='channel-moderation--body'>

                        <table
                            id='channel_moderation_table'
                            className='channel-moderation--table'
                        >
                            <thead>
                                <tr>
                                    <th>
                                        <FormattedMessage
                                            id='admin.channel_settings.channel_moderation.permissions'
                                            defaultMessage='Permissions'
                                        />
                                    </th>
                                    {guestAccountsEnabled &&
                                        <th>
                                            <FormattedMessage
                                                id='admin.channel_settings.channel_moderation.guests'
                                                defaultMessage='Guests'
                                            />
                                        </th>
                                    }
                                    <th>
                                        <FormattedMessage
                                            id='admin.channel_settings.channel_moderation.members'
                                            defaultMessage='Members'
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {channelPermissions?.map((entry) => {
                                    return (
                                        <ChannelModerationTableRow
                                            key={entry.name}
                                            name={entry.name}
                                            guests={entry.roles.guests?.value}
                                            guestsDisabled={!entry.roles.guests?.enabled}
                                            members={entry.roles.members.value}
                                            membersDisabled={!entry.roles.members.enabled}
                                            onClick={onChannelPermissionsChanged}
                                            errorMessages={this.errorMessagesToDisplay(entry)}
                                            guestAccountsEnabled={guestAccountsEnabled}
                                            readOnly={readOnly}
                                        />
                                    );
                                })}

                            </tbody>
                        </table>

                    </div>
                </div>
            </AdminPanel>
        );
    };
}
