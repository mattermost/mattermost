// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {isDirectChannel, isGroupChannel} from 'mattermost-redux/utils/channel_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {getChannelURL, getPermalinkURL} from 'selectors/urls';

import {stripMarkdown} from 'utils/markdown';
import {createBurstNotificationId} from 'utils/platform_notification_activity_merge';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

export function getActivityContextLabel(isThreadReply: boolean, isMention: boolean, isAddedToChannel = false): string {
    if (isAddedToChannel) {
        return Utils.localizeMessage({id: 'notification.sidebar.context.added_to_channel', defaultMessage: 'Added to channel'});
    }
    if (isThreadReply && isMention) {
        return Utils.localizeMessage({id: 'notification.sidebar.context.thread_mention', defaultMessage: 'Mention in thread'});
    }
    if (isThreadReply) {
        return Utils.localizeMessage({id: 'notification.sidebar.context.thread_message', defaultMessage: 'Message in thread'});
    }
    if (isMention) {
        return Utils.localizeMessage({id: 'notification.sidebar.context.mention', defaultMessage: 'Mention'});
    }
    return Utils.localizeMessage({id: 'notification.sidebar.context.message', defaultMessage: 'Message'});
}

export function getActivityPreviewBody(state: GlobalState, post: Post): string {
    const sender = getUser(state, post.user_id);
    const username = sender ? displayUsername(sender, getTeammateNameDisplaySetting(state), false) : Utils.localizeMessage({id: 'channel_loader.someone', defaultMessage: 'Someone'});
    const text = stripMarkdown(post.message || '');
    if (!text) {
        return `@${username}`;
    }
    return `@${username}: ${text}`;
}

export function buildPlatformNotificationRecordFromPost(
    state: GlobalState,
    post: Post,
    channel: Channel,
    teamId: string,
    flags: {
        isMention: boolean;
        isThreadReply: boolean;
        isAddedToChannel?: boolean;
        recordedAt?: number;
        replyCount?: number;
        participantUserIds?: string[];
    },
): PlatformNotificationRecord {
    const recordedAt = flags.recordedAt ?? post.create_at;
    const isDirectMessage = isDirectChannel(channel);
    const isGroupMessage = isGroupChannel(channel);
    const permalinkUrl = flags.isThreadReply ? getPermalinkURL(state, teamId, post.id) : getChannelURL(state, channel, teamId);
    const threadRootId = flags.isThreadReply ? (post.root_id || post.id) : undefined;

    const baseRecord = {
        recordedAt,
        postId: post.id,
        channelId: channel.id,
        teamId: teamId || channel.team_id || '',
        channelDisplayName: channel.display_name || '',
        contextLabel: getActivityContextLabel(flags.isThreadReply, flags.isMention, flags.isAddedToChannel),
        permalinkUrl,
        isThreadReply: flags.isThreadReply,
        isMention: flags.isMention,
        isDirectMessage,
        isGroupMessage,
        senderUserId: post.user_id,
        threadRootId,
        replyCount: flags.replyCount,
        participantUserIds: flags.participantUserIds,
        previewBody: getActivityPreviewBody(state, post),
    };

    return {
        ...baseRecord,
        id: (flags.isThreadReply || isDirectMessage || isGroupMessage) ? createBurstNotificationId(baseRecord) : `${post.id}:${recordedAt}`,
    };
}
