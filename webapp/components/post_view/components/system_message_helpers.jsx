// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {PostTypes} from 'utils/constants.jsx';

function renderJoinChannelMessage(post) {
    return (
        <FormattedMessage
            id='api.channel.join_channel.post_and_forget'
            defaultMessage='{username} has joined the channel.'
            values={{username: post.props.username}}
        />
    );
}

function renderLeaveChannelMessage(post) {
    return (
        <FormattedMessage
            id='api.channel.leave.left'
            defaultMessage='{username} has left the channel.'
            values={{username: post.props.username}}
        />
    );
}

function renderAddToChannelMessage(post) {
    return (
        <FormattedMessage
            id='api.channel.add_member.added'
            defaultMessage='{addedUsername} added to the channel by {username}'
            values={{
                username: post.props.username,
                addedUsername: post.props.addedUsername
            }}
        />
    );
}

function renderRemoveFromChannelMessage(post) {
    return (
        <FormattedMessage
            id='api.channel.remove_member.removed'
            defaultMessage='{removedUsername} was removed from the channel'
            values={{
                removedUsername: post.props.removedUsername
            }}
        />
    );
}

function renderHeaderChangeMessage(post) {
    if (!post.props.username) {
        return null;
    }

    if (post.props.new_header) {
        if (post.props.old_header) {
            return (
                <FormattedMessage
                    id='api.channel.post_update_channel_header_message_and_forget.updated_from'
                    defaultMessage='{username} updated the channel header from: {old} to: {new}'
                    values={{
                        username: post.props.username,
                        old: post.props.old_header,
                        new: post.props.new_header
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='api.channel.post_update_channel_header_message_and_forget.updated_to'
                defaultMessage='{username} updated the channel header to: {new}'
                values={{
                    username: post.props.username,
                    new: post.props.new_header
                }}
            />
        );
    } else if (post.props.old_header) {
        return (
            <FormattedMessage
                id='api.channel.post_update_channel_header_message_and_forget.removed'
                defaultMessage='{username} removed the channel header (was: {old})'
                values={{
                    username: post.props.username,
                    old: post.props.old_header
                }}
            />
        );
    }

    return null;
}

function renderDisplayNameChangeMessage(post) {
    if (!(post.props.username && post.props.old_displayname && post.props.new_displayname)) {
        return null;
    }

    return (
        <FormattedMessage
            id='api.channel.post_update_channel_displayname_message_and_forget.updated_from'
            defaultMessage='{username} updated the channel display name from: {old} to: {new}'
            values={{
                username: post.props.username,
                old: post.props.old_displayname,
                new: post.props.new_displayname
            }}
        />
    );
}

function renderPurposeChangeMessage(post) {
    if (!post.props.username) {
        return null;
    }

    if (post.props.new_purpose) {
        if (post.props.old_purpose) {
            return (
                <FormattedMessage
                    id='app.channel.post_update_channel_purpose_message.updated_from'
                    defaultMessage='{username} updated the channel purpose from: {old} to: {new}'
                    values={{
                        username: post.props.username,
                        old: post.props.old_purpose,
                        new: post.props.new_purpose
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='app.channel.post_update_channel_purpose_message.updated_to'
                defaultMessage='{username} updated the channel purpose to: {new}'
                values={{
                    username: post.props.username,
                    new: post.props.new_purpose
                }}
            />
        );
    } else if (post.props.old_purpose) {
        return (
            <FormattedMessage
                id='app.channel.post_update_channel_purpose_message.removed'
                defaultMessage='{username} removed the channel purpose (was: {old})'
                values={{
                    username: post.props.username,
                    old: post.props.old_purpose
                }}
            />
        );
    }

    return null;
}

function renderChannelDeletedMessage(post) {
    if (!post.props.username) {
        return null;
    }

    return (
        <FormattedMessage
            id='api.channel.delete_channel.archived'
            defaultMessage='{username} has archived the channel.'
            values={{
                username: post.props.username
            }}
        />
    );
}

const systemMessageRenderers = {
    [PostTypes.JOIN_CHANNEL]: renderJoinChannelMessage,
    [PostTypes.LEAVE_CHANNEL]: renderLeaveChannelMessage,
    [PostTypes.ADD_TO_CHANNEL]: renderAddToChannelMessage,
    [PostTypes.REMOVE_FROM_CHANNEL]: renderRemoveFromChannelMessage,
    [PostTypes.HEADER_CHANGE]: renderHeaderChangeMessage,
    [PostTypes.DISPLAYNAME_CHANGE]: renderDisplayNameChangeMessage,
    [PostTypes.PURPOSE_CHANGE]: renderPurposeChangeMessage,
    [PostTypes.CHANNEL_DELETED]: renderChannelDeletedMessage
};

export function renderSystemMessage(post) {
    if (!systemMessageRenderers[post.type]) {
        return null;
    }

    return systemMessageRenderers[post.type](post);
}
