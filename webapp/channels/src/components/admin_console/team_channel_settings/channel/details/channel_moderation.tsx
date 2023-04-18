// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import {isNil} from 'lodash';
import classNames from 'classnames';

import {ChannelModeration as ChannelPermissions} from '@mattermost/types/channels';
import {Permissions, Roles} from 'mattermost-redux/constants';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {t} from 'utils/i18n';

import AdminPanel from 'components/widgets/admin_console/admin_panel';
import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';

import {ChannelModerationRoles} from './types';

const PERIOD_TO_SLASH_REGEX = /\./g;

const channelModerationTranslations = ({
    [Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST]: {
        title: defineMessage({
            id: t('admin.channel_settings.channel_moderation.createPosts'),
            defaultMessage: 'Create Posts',
        }),
        description: defineMessage({
            id: t('admin.channel_settings.channel_moderation.createPostsDesc'),
            defaultMessage: 'The ability for members and guests to create posts in the channel.',
        }),
        descriptionMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.createPostsDescMembers'),
            defaultMessage: 'The ability for members to create posts in the channel.',
        }),
        disabledGuests: defineMessage({
            id: t('admin.channel_settings.channel_moderation.createPosts.disabledGuest'),
            defaultMessage: 'Create posts for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'guest_create_post',
        }),
        disabledMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.createPosts.disabledMember'),
            defaultMessage: 'Create posts for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'create_post',
        }),
        disabledBoth: defineMessage({
            id: t('admin.channel_settings.channel_moderation.createPosts.disabledBoth'),
            defaultMessage: 'Create posts for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'create_post',
        }),
    },

    [Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_REACTIONS]: {
        title: defineMessage({
            id: t('admin.channel_settings.channel_moderation.postReactions'),
            defaultMessage: 'Post Reactions',
        }),
        description: defineMessage({
            id: t('admin.channel_settings.channel_moderation.postReactionsDesc'),
            defaultMessage: 'The ability for members and guests to post reactions.',
        }),
        descriptionMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.postReactionsDescMembers'),
            defaultMessage: 'The ability for members to post reactions.',
        }),
        disabledGuests: defineMessage({
            id: t('admin.channel_settings.channel_moderation.postReactions.disabledGuest'),
            defaultMessage: 'Post reactions for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'guest_reactions',
        }),
        disabledMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.postReactions.disabledMember'),
            defaultMessage: 'Post reactions for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'reactions',
        }),
        disabledBoth: defineMessage({
            id: t('admin.channel_settings.channel_moderation.postReactions.disabledBoth'),
            defaultMessage: 'Post reactions for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'reactions',
        }),
    },

    [Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_MEMBERS]: {
        title: defineMessage({
            id: t('admin.channel_settings.channel_moderation.manageMembers'),
            defaultMessage: 'Manage Members',
        }),
        description: defineMessage({
            id: t('admin.channel_settings.channel_moderation.manageMembersDesc'),
            defaultMessage: 'The ability for members to add and remove people.',
        }),
        disabledGuests: defineMessage({
            id: t('admin.channel_settings.channel_moderation.manageMembers.disabledGuest'),
            defaultMessage: 'Manage members for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'guest_manage_{public_or_private}_channel_members',
        }),
        disabledMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.manageMembers.disabledMember'),
            defaultMessage: 'Manage members for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'manage_{public_or_private}_channel_members',
        }),
        disabledBoth: defineMessage({
            id: t('admin.channel_settings.channel_moderation.manageMembers.disabledBoth'),
            defaultMessage: 'Manage members for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'manage_{public_or_private}_channel_members',
        }),
    },

    [Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS]: {
        title: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions'),
            defaultMessage: 'Channel Mentions',
        }),
        description: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentionsDesc'),
            defaultMessage: 'The ability for members and guests to use @all, @here and @channel.',
        }),
        descriptionMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentionsDescMembers'),
            defaultMessage: 'The ability for members to use @all, @here and @channel.',
        }),
        disabledGuests: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions.disabledGuest'),
            defaultMessage: 'Channel mentions for guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'guest_use_channel_mentions',
        }),
        disabledMembers: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions.disabledMember'),
            defaultMessage: 'Channel mentions for members are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'use_channel_mentions',
        }),
        disabledBoth: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions.disabledBoth'),
            defaultMessage: 'Channel mentions for members and guests are disabled in [{scheme_name}](../permissions/{scheme_link}).',
            permissionName: 'use_channel_mentions',
        }),
        disabledGuestsDueToCreatePosts: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions.disabledGuestsDueToCreatePosts'),
            defaultMessage: 'Guests can not use channel mentions without the ability to create posts.',
        }),
        disabledMembersDueToCreatePosts: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions.disabledMemberDueToCreatePosts'),
            defaultMessage: 'Members can not use channel mentions without the ability to create posts.',
        }),
        disabledBothDueToCreatePosts: defineMessage({
            id: t('admin.channel_settings.channel_moderation.channelMentions.disabledBothDueToCreatePosts'),
            defaultMessage: 'Guests and members can not use channel mentions without the ability to create posts.',
        }),
    },
});

const titleMessage = defineMessage({
    id: t('admin.channel_settings.channel_moderation.title'),
    defaultMessage: 'Channel Moderation',
});
const subtitleMessage = defineMessage({
    id: t('admin.channel_settings.channel_moderation.subtitle'),
    defaultMessage: 'Manage the actions available to channel members and guests.',
});
const subtitleMembersMessage = defineMessage({
    id: t('admin.channel_settings.channel_moderation.subtitleMembers'),
    defaultMessage: 'Manage the actions available to channel members.',
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
    let descriptionId = channelModerationTranslations[props.name].description.id;
    let descriptionDefaultMessage = channelModerationTranslations[props.name].description.defaultMessage;
    if (!props.guestAccountsEnabled && channelModerationTranslations[props.name].descriptionMembers) {
        descriptionId = channelModerationTranslations[props.name].descriptionMembers?.id ?? '';
        descriptionDefaultMessage = channelModerationTranslations[props.name]?.descriptionMembers?.defaultMessage ?? '';
    }
    return (
        <tr>
            <td>
                <label
                    data-testid={channelModerationTranslations[props.name].title.id.replace(PERIOD_TO_SLASH_REGEX, '-')}
                >
                    <FormattedMessage
                        id={channelModerationTranslations[props.name].title.id}
                        defaultMessage={channelModerationTranslations[props.name].title.defaultMessage}
                    />
                </label>
                <div
                    data-testid={channelModerationTranslations[props.name].description.id.replace(PERIOD_TO_SLASH_REGEX, '-')}
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
        const errorMessages: JSX.Element[] = [];
        const isGuestsDisabled = !isNil(entry.roles.guests?.enabled) && !entry.roles.guests?.enabled && this.props.guestAccountsEnabled;
        const isMembersDisabled = !entry.roles.members.enabled;
        let createPostsKey = '';
        if (entry.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS) {
            const createPostsObject = this.props.channelPermissions && this.props.channelPermissions!.find((permission) => permission.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST);
            if (!createPostsObject!.roles.guests!.value && this.props.guestAccountsEnabled && !createPostsObject!.roles.members!.value) {
                errorMessages.push(
                    <div
                        data-testid={channelModerationTranslations[entry.name]?.disabledBothDueToCreatePosts?.id?.replace(PERIOD_TO_SLASH_REGEX, '-')}
                        key={channelModerationTranslations[entry.name]?.disabledBothDueToCreatePosts?.id}
                    >
                        <FormattedMessage
                            id={channelModerationTranslations[entry.name]?.disabledBothDueToCreatePosts?.id}
                            defaultMessage={channelModerationTranslations[entry.name]?.disabledBothDueToCreatePosts?.defaultMessage}
                        />
                    </div>,
                );
                return errorMessages;
            } else if (!createPostsObject!.roles.guests!.value && this.props.guestAccountsEnabled) {
                createPostsKey = 'disabledGuestsDueToCreatePosts';
                errorMessages.push(
                    <div
                        data-testid={channelModerationTranslations[entry.name]?.disabledGuestsDueToCreatePosts?.id.replace(PERIOD_TO_SLASH_REGEX, '-')}
                        key={channelModerationTranslations[entry.name]?.disabledGuestsDueToCreatePosts?.id}
                    >
                        <FormattedMessage
                            id={channelModerationTranslations[entry.name]?.disabledGuestsDueToCreatePosts?.id}
                            defaultMessage={channelModerationTranslations[entry.name]?.disabledGuestsDueToCreatePosts?.defaultMessage}
                        />
                    </div>,
                );
            } else if (!createPostsObject!.roles.members!.value) {
                createPostsKey = 'disabledMembersDueToCreatePosts';
                errorMessages.push(
                    <div
                        data-testid={channelModerationTranslations[entry.name]?.disabledMembersDueToCreatePosts?.id.replace(PERIOD_TO_SLASH_REGEX, '-')}
                        key={channelModerationTranslations[entry.name]?.disabledMembersDueToCreatePosts?.id}
                    >
                        <FormattedMessage
                            id={channelModerationTranslations[entry.name]?.disabledMembersDueToCreatePosts?.id}
                            defaultMessage={channelModerationTranslations[entry.name]?.disabledMembersDueToCreatePosts?.defaultMessage}
                        />
                    </div>,
                );
            }
        }

        let disabledKey;
        let schemeName = 'System Scheme';
        let schemeLink = 'system_scheme';
        let disabledKeyId = '';
        let disabledKeyMessage = '';

        if (this.props.teamSchemeID) {
            schemeName = this.props?.teamSchemeDisplayName + ' Team Scheme';
            schemeLink = `team_override_scheme/${this.props.teamSchemeID}`;
        }

        if (isGuestsDisabled && isMembersDisabled && errorMessages.length <= 0) {
            disabledKey = 'disabledBoth';
            if (channelModerationTranslations?.[entry.name]?.disabledBoth?.permissionName) {
                schemeLink += `?rowIdFromQuery=${channelModerationTranslations[entry.name]?.disabledBoth?.permissionName}`;
                if (schemeLink.includes('{public_or_private}')) {
                    const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
                    schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
                }
            }
            disabledKeyId = channelModerationTranslations?.[entry.name]?.disabledBoth?.id;
            disabledKeyMessage = channelModerationTranslations[entry.name]?.disabledBoth?.defaultMessage;
        } else if (isGuestsDisabled && createPostsKey !== 'disabledGuestsDueToCreatePosts') {
            disabledKey = 'disabledGuests';
            if (channelModerationTranslations?.[entry.name]?.disabledGuests?.permissionName) {
                schemeLink += `?rowIdFromQuery=${channelModerationTranslations[entry.name]?.disabledGuests.permissionName}`;
                if (schemeLink.includes('{public_or_private}')) {
                    const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
                    schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
                }
            }
            disabledKeyId = channelModerationTranslations?.[entry.name]?.disabledGuests?.id;
            disabledKeyMessage = channelModerationTranslations[entry.name]?.disabledGuests?.defaultMessage;
        } else if (isMembersDisabled && createPostsKey !== 'disabledMembersDueToCreatePosts') {
            disabledKey = 'disabledMembers';
            if (channelModerationTranslations?.[entry.name]?.disabledMembers?.permissionName) {
                schemeLink += `?rowIdFromQuery=${channelModerationTranslations[entry.name]?.disabledMembers?.permissionName}`;
                if (schemeLink.includes('{public_or_private}')) {
                    const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
                    schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
                }
            }
            disabledKeyId = channelModerationTranslations?.[entry.name]?.disabledMembers?.id;
            disabledKeyMessage = channelModerationTranslations[entry.name]?.disabledMembers?.defaultMessage;
        }

        if (schemeLink.includes('{public_or_private}')) {
            const publicOrPrivate = this.props.isPublic ? 'public' : 'private';
            schemeLink = schemeLink.replace('{public_or_private}', publicOrPrivate);
        }

        if (disabledKey) {
            errorMessages.push(
                <div
                    data-testid={disabledKeyId.replace(PERIOD_TO_SLASH_REGEX, '-')}
                    key={disabledKeyId}
                >
                    <FormattedMarkdownMessage
                        id={disabledKeyId}
                        defaultMessage={disabledKeyMessage}
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
                titleId={titleMessage.id}
                titleDefault={titleMessage.defaultMessage}
                subtitleId={guestAccountsEnabled ? subtitleMessage.id : subtitleMembersMessage.id}
                subtitleDefault={guestAccountsEnabled ? subtitleMessage.defaultMessage : subtitleMembersMessage.defaultMessage}
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
