// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime, defineMessages} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import {isStringArray} from '@mattermost/types/utilities';

import {General, Posts} from 'mattermost-redux/constants';
import {isUserActivityProp} from 'mattermost-redux/utils/post_list';
import {ensureNumber, ensureString, isPostEphemeral} from 'mattermost-redux/utils/post_utils';

import Markdown from 'components/markdown';
import CombinedSystemMessage from 'components/post_view/combined_system_message';
import GMConversionMessage from 'components/post_view/gm_conversion_message/gm_conversion_message';
import PostAddChannelMember from 'components/post_view/post_add_channel_member';

import {isChannelNamesMap, type TextFormattingOptions} from 'utils/text_formatting';
import {getSiteURL} from 'utils/url';

export function renderUsername(value: unknown): ReactNode {
    const verifiedValue = ensureString(value);
    const username = (verifiedValue[0] === '@') ? verifiedValue : `@${verifiedValue}`;

    const options = {
        markdown: false,
    };

    return renderFormattedText(username, options);
}

function renderFormattedText(value: unknown, options?: Partial<TextFormattingOptions>, post?: Post): ReactNode {
    const verifiedValue = ensureString(value);
    return (
        <Markdown
            message={verifiedValue}
            options={options}
            postId={post && post.id}
            postType={post && post.type}
        />
    );
}

function renderJoinChannelMessage(post: Post): ReactNode {
    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.channel.join_channel.post_and_forget'
            defaultMessage='{username} joined the channel.'
            values={{username}}
        />
    );
}

function renderGuestJoinChannelMessage(post: Post, hideGuestTags: boolean): ReactNode {
    if (hideGuestTags) {
        return renderJoinChannelMessage(post);
    }
    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.channel.guest_join_channel.post_and_forget'
            defaultMessage='{username} joined the channel as a guest.'
            values={{username}}
        />
    );
}

function renderLeaveChannelMessage(post: Post): ReactNode {
    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.channel.leave.left'
            defaultMessage='{username} has left the channel.'
            values={{username}}
        />
    );
}

function renderAddToChannelMessage(post: Post): ReactNode {
    const username = renderUsername(post.props.username);
    const addedUsername = renderUsername(post.props.addedUsername);

    return (
        <FormattedMessage
            id='api.channel.add_member.added'
            defaultMessage='{addedUsername} added to the channel by {username}.'
            values={{
                username,
                addedUsername,
            }}
        />
    );
}

function renderAddGuestToChannelMessage(post: Post, hideGuestTags: boolean): ReactNode {
    if (hideGuestTags) {
        return renderAddToChannelMessage(post);
    }
    const username = renderUsername(post.props.username);
    const addedUsername = renderUsername(post.props.addedUsername);

    return (
        <FormattedMessage
            id='api.channel.add_guest.added'
            defaultMessage='{addedUsername} added to the channel as a guest by {username}.'
            values={{
                username,
                addedUsername,
            }}
        />
    );
}

function renderRemoveFromChannelMessage(post: Post): ReactNode {
    const removedUsername = renderUsername(post.props.removedUsername);

    return (
        <FormattedMessage
            id='api.channel.remove_member.removed'
            defaultMessage='{removedUsername} was removed from the channel'
            values={{
                removedUsername,
            }}
        />
    );
}

function renderJoinTeamMessage(post: Post): ReactNode {
    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.team.join_team.post_and_forget'
            defaultMessage='{username} joined the team.'
            values={{username}}
        />
    );
}

function renderLeaveTeamMessage(post: Post): ReactNode {
    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.team.leave.left'
            defaultMessage='{username} left the team.'
            values={{username}}
        />
    );
}

function renderAddToTeamMessage(post: Post): ReactNode {
    const username = renderUsername(post.props.username);
    const addedUsername = renderUsername(post.props.addedUsername);

    return (
        <FormattedMessage
            id='api.team.add_member.added'
            defaultMessage='{addedUsername} added to the team by {username}.'
            values={{
                username,
                addedUsername,
            }}
        />
    );
}

function renderRemoveFromTeamMessage(post: Post): ReactNode {
    const removedUsername = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.team.remove_user_from_team.removed'
            defaultMessage='{removedUsername} was removed from the team.'
            values={{
                removedUsername,
            }}
        />
    );
}

function renderHeaderChangeMessage(post: Post): ReactNode {
    if (!post.props.username) {
        return null;
    }

    const headerOptions = {
        channelNamesMap: isChannelNamesMap(post.props?.channel_mentions) ? post.props.channel_mentions : undefined,
        mentionHighlight: true,
    };

    const username = renderUsername(post.props.username);
    const oldHeader = post.props.old_header ? renderFormattedText(post.props.old_header, headerOptions, post) : null;
    const newHeader = post.props.new_header ? renderFormattedText(post.props.new_header, headerOptions, post) : null;

    if (post.props.new_header) {
        if (post.props.old_header) {
            return (
                <FormattedMessage
                    id='api.channel.post_update_channel_header_message_and_forget.updated_from'
                    defaultMessage='{username} updated the channel header <br></br><strong>From:</strong> {old} <br></br><strong>To:</strong> {new}'
                    values={{
                        username,
                        old: oldHeader,
                        new: newHeader,
                        strong: (chunks: React.ReactNode) => (<strong>{chunks}</strong>),
                        br: (x: React.ReactNode) => (<><br/>{x}</>),
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='api.channel.post_update_channel_header_message_and_forget.updated_to'
                defaultMessage='{username} updated the channel header to: {new}'
                values={{
                    username,
                    new: newHeader,
                }}
            />
        );
    } else if (post.props.old_header) {
        return (
            <FormattedMessage
                id='api.channel.post_update_channel_header_message_and_forget.removed'
                defaultMessage='{username} removed the channel header (was: {old})'
                values={{
                    username,
                    old: oldHeader,
                }}
            />
        );
    }

    return null;
}

function renderDisplayNameChangeMessage(post: Post): ReactNode {
    if (!(post.props.username && post.props.old_displayname && post.props.new_displayname)) {
        return null;
    }

    const username = renderUsername(post.props.username);
    const oldDisplayName = post.props.old_displayname;
    const newDisplayName = post.props.new_displayname;

    return (
        <FormattedMessage
            id='api.channel.post_update_channel_displayname_message_and_forget.updated_from'
            defaultMessage='{username} updated the channel display name from: {old} to: {new}'
            values={{
                username,
                old: oldDisplayName,
                new: newDisplayName,
            }}
        />
    );
}

function renderConvertChannelToPrivateMessage(post: Post): ReactNode {
    if (!(post.props.username)) {
        return null;
    }

    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.channel.post_convert_channel_to_private.updated_from'
            defaultMessage='{username} converted the channel from public to private'
            values={{
                username,
            }}
        />
    );
}

function renderPurposeChangeMessage(post: Post): ReactNode {
    if (!post.props.username) {
        return null;
    }

    const username = renderUsername(post.props.username);
    const oldPurpose = post.props.old_purpose;
    const newPurpose = post.props.new_purpose;

    if (post.props.new_purpose) {
        if (post.props.old_purpose) {
            return (
                <FormattedMessage
                    id='app.channel.post_update_channel_purpose_message.updated_from'
                    defaultMessage='{username} updated the channel purpose from: {old} to: {new}'
                    values={{
                        username,
                        old: oldPurpose,
                        new: newPurpose,
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='app.channel.post_update_channel_purpose_message.updated_to'
                defaultMessage='{username} updated the channel purpose to: {new}'
                values={{
                    username,
                    new: newPurpose,
                }}
            />
        );
    } else if (post.props.old_purpose) {
        return (
            <FormattedMessage
                id='app.channel.post_update_channel_purpose_message.removed'
                defaultMessage='{username} removed the channel purpose (was: {old})'
                values={{
                    username,
                    old: oldPurpose,
                }}
            />
        );
    }

    return null;
}

function renderChannelDeletedMessage(post: Post): ReactNode {
    if (!post.props.username) {
        return null;
    }

    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.channel.delete_channel.archived'
            defaultMessage='{username} has archived the channel.'
            values={{username}}
        />
    );
}

function renderChannelUnarchivedMessage(post: Post): ReactNode {
    if (!post.props.username) {
        return null;
    }

    const username = renderUsername(post.props.username);

    return (
        <FormattedMessage
            id='api.channel.restore_channel.unarchived'
            defaultMessage='{username} has unarchived the channel.'
            values={{username}}
        />
    );
}

function renderMeMessage(post: Post): ReactNode {
    // Trim off the leading and trailing asterisk added to /me messages
    const message = post.message.replace(/^\*|\*$/g, '');

    return renderFormattedText(message);
}

const systemMessageRenderers = {
    [Posts.POST_TYPES.JOIN_CHANNEL]: renderJoinChannelMessage,
    [Posts.POST_TYPES.LEAVE_CHANNEL]: renderLeaveChannelMessage,
    [Posts.POST_TYPES.ADD_TO_CHANNEL]: renderAddToChannelMessage,
    [Posts.POST_TYPES.EPHEMERAL_ADD_TO_CHANNEL]: renderAddToChannelMessage,
    [Posts.POST_TYPES.REMOVE_FROM_CHANNEL]: renderRemoveFromChannelMessage,
    [Posts.POST_TYPES.JOIN_TEAM]: renderJoinTeamMessage,
    [Posts.POST_TYPES.LEAVE_TEAM]: renderLeaveTeamMessage,
    [Posts.POST_TYPES.ADD_TO_TEAM]: renderAddToTeamMessage,
    [Posts.POST_TYPES.REMOVE_FROM_TEAM]: renderRemoveFromTeamMessage,
    [Posts.POST_TYPES.HEADER_CHANGE]: renderHeaderChangeMessage,
    [Posts.POST_TYPES.DISPLAYNAME_CHANGE]: renderDisplayNameChangeMessage,
    [Posts.POST_TYPES.CONVERT_CHANNEL]: renderConvertChannelToPrivateMessage,
    [Posts.POST_TYPES.PURPOSE_CHANGE]: renderPurposeChangeMessage,
    [Posts.POST_TYPES.CHANNEL_DELETED]: renderChannelDeletedMessage,
    [Posts.POST_TYPES.CHANNEL_UNARCHIVED]: renderChannelUnarchivedMessage,
    [Posts.POST_TYPES.ME]: renderMeMessage,
};

export type AddMemberProps = {
    post_id: string;
    not_in_channel_user_ids: string[];
    not_in_groups_usernames: string[];
    not_in_channel_usernames: string[];
}

export function isAddMemberProps(v: unknown): v is AddMemberProps {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if (!('post_id' in v) || typeof v.post_id !== 'string') {
        return false;
    }

    if (!('not_in_channel_user_ids' in v) || !isStringArray(v.not_in_channel_user_ids)) {
        return false;
    }

    if (!('not_in_groups_usernames' in v) || !isStringArray(v.not_in_groups_usernames)) {
        return false;
    }

    if (!('not_in_channel_usernames' in v) || !isStringArray(v.not_in_channel_usernames)) {
        return false;
    }

    return true;
}

export function renderSystemMessage(post: Post, currentTeamName: string, channel: Channel, hideGuestTags: boolean, isUserCanManageMembers?: boolean, isMilitaryTime?: boolean, timezone?: string): ReactNode {
    const isEphemeral = isPostEphemeral(post);
    if (isEphemeral && post.props?.type === Posts.POST_TYPES.REMINDER) {
        return renderReminderACKMessage(post, currentTeamName, Boolean(isMilitaryTime), timezone);
    }
    if (isAddMemberProps(post.props?.add_channel_member)) {
        if (channel && (channel.type === General.PRIVATE_CHANNEL || channel.type === General.OPEN_CHANNEL) &&
            isUserCanManageMembers &&
            isEphemeral
        ) {
            const addMemberProps = post.props.add_channel_member;
            return (
                <PostAddChannelMember
                    postId={addMemberProps.post_id}
                    userIds={addMemberProps.not_in_channel_user_ids}
                    noGroupsUsernames={addMemberProps.not_in_groups_usernames}
                    usernames={addMemberProps.not_in_channel_usernames}
                />
            );
        }

        return null;
    } else if (systemMessageRenderers[post.type]) {
        return systemMessageRenderers[post.type](post);
    } else if (post.type === Posts.POST_TYPES.GUEST_JOIN_CHANNEL) {
        return renderGuestJoinChannelMessage(post, hideGuestTags);
    } else if (post.type === Posts.POST_TYPES.ADD_GUEST_TO_CHANNEL) {
        return renderAddGuestToChannelMessage(post, hideGuestTags);
    } else if (post.type === Posts.POST_TYPES.COMBINED_USER_ACTIVITY && isUserActivityProp(post.props.user_activity)) {
        const {allUserIds, allUsernames, messageData} = post.props.user_activity;

        return (
            <CombinedSystemMessage
                allUserIds={allUserIds}
                allUsernames={allUsernames}
                messageData={messageData}
            />
        );
    } else if (post.type === Posts.POST_TYPES.GM_CONVERTED_TO_CHANNEL) {
        // This is rendered via a separate component instead of registering in
        // systemMessageRenderers because we need to format a list with keeping i18n support
        // which cannot be done outside a react component.
        return (
            <GMConversionMessage post={post}/>
        );
    }

    return null;
}

function renderReminderACKMessage(post: Post, currentTeamName: string, isMilitaryTime: boolean, timezone?: string): ReactNode {
    const username = renderUsername(post.props.username);
    const teamUrl = `${getSiteURL()}/${post.props.team_name || currentTeamName}`;
    const link = `${teamUrl}/pl/${post.props.post_id}`;
    const permaLink = renderFormattedText(`[${link}](${link})`);
    const targetTime = ensureNumber(post.props.target_time);
    const localTime = new Date(targetTime * 1000);

    const reminderTime = (
        <FormattedTime
            value={localTime}
            hour12={!isMilitaryTime}
            timeZone={timezone}
        />);
    const reminderDate = (
        <FormattedDate
            value={localTime}
            day='2-digit'
            month='short'
            year='numeric'
            timeZone={timezone}
        />);
    return (
        <FormattedMessage
            id={'post.reminder.acknowledgement'}
            defaultMessage='You will be reminded at {reminderTime}, {reminderDate} about this message from {username}: {permaLink}'
            values={{
                reminderTime,
                reminderDate,
                username,
                permaLink,
            }}
        />
    );
}

export function renderReminderSystemBotMessage(post: Post, currentTeam: Team): ReactNode {
    const username = post.props.username ? renderUsername(post.props.username) : '';
    const teamUrl = `${getSiteURL()}/${post.props.team_name || currentTeam.name}`;
    const link = `${teamUrl}/pl/${post.props.post_id}`;
    const permaLink = renderFormattedText(`[${link}](${link})`);
    return (
        <FormattedMessage
            id={'post.reminder.systemBot'}
            defaultMessage="Hi there, here's your reminder about this message from {username}: {permaLink}"
            values={{
                username,
                permaLink,
            }}
        />
    );
}

// These messages are used by app.MoveThread on the server
defineMessages({
    channelMultipleMessages: {
        id: 'app.post.move_thread_command.channel.multiple_messages',
        defaultMessage: 'A thread with {numMessages, number} messages has been moved: {link}\n',
    },
    channelOneMessage: {
        id: 'app.post.move_thread_command.channel.one_message',
        defaultMessage: 'A message has been moved: {link}\n',
    },
    dmMultipleMessages: {
        id: 'app.post.move_thread_command.direct_or_group.multiple_messages',
        defaultMessage: 'A thread with {numMessages, number} messages has been moved to a Direct/Group Message\n',
    },
    dmOneMessage: {
        id: 'app.post.move_thread_command.direct_or_group.one_message',
        defaultMessage: 'A message has been moved to a Direct/Group Message\n',
    },
    fromAnotherChannel: {
        id: 'app.post.move_thread.from_another_channel',
        defaultMessage: 'This thread was moved from another channel',
    },
});

export function renderWranglerSystemMessage(post: Post): ReactNode {
    let values: React.ComponentProps<typeof FormattedMessage>['values'] = {};
    const id = ensureString(post.props?.TranslationID);
    const movedThreadPermalink = ensureString(post.props?.MovedThreadPermalink);
    if (movedThreadPermalink) {
        values = {
            link: movedThreadPermalink,
        };
        const numMessages = ensureNumber(post.props.NumMessages);
        if (numMessages > 1) {
            values.number = post.props.NumMessages;
        }
    }
    return (
        <FormattedMessage
            id={id}
            defaultMessage={post.message}
            values={values}
        />
    );
}
