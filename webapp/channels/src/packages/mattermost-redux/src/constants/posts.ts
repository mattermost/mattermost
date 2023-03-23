// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostType} from '@mattermost/types/posts';

export const PostTypes = {
    CHANNEL_DELETED: 'system_channel_deleted' as PostType,
    CHANNEL_UNARCHIVED: 'system_channel_restored' as PostType,
    DISPLAYNAME_CHANGE: 'system_displayname_change' as PostType,
    CONVERT_CHANNEL: 'system_convert_channel' as PostType,
    EPHEMERAL: 'system_ephemeral' as PostType,
    EPHEMERAL_ADD_TO_CHANNEL: 'system_ephemeral_add_to_channel' as PostType,
    HEADER_CHANGE: 'system_header_change' as PostType,
    PURPOSE_CHANGE: 'system_purpose_change' as PostType,

    JOIN_LEAVE: 'system_join_leave' as PostType,
    JOIN_CHANNEL: 'system_join_channel' as PostType,
    GUEST_JOIN_CHANNEL: 'system_guest_join_channel' as PostType,
    LEAVE_CHANNEL: 'system_leave_channel' as PostType,
    ADD_REMOVE: 'system_add_remove' as PostType,
    ADD_TO_CHANNEL: 'system_add_to_channel' as PostType,
    ADD_GUEST_TO_CHANNEL: 'system_add_guest_to_chan' as PostType,
    REMOVE_FROM_CHANNEL: 'system_remove_from_channel' as PostType,

    JOIN_TEAM: 'system_join_team' as PostType,
    LEAVE_TEAM: 'system_leave_team' as PostType,
    ADD_TO_TEAM: 'system_add_to_team' as PostType,
    REMOVE_FROM_TEAM: 'system_remove_from_team' as PostType,

    COMBINED_USER_ACTIVITY: 'system_combined_user_activity' as PostType,
    ME: 'me' as PostType,
    ADD_BOT_TEAMS_CHANNELS: 'add_bot_teams_channels' as PostType,
    SYSTEM_WARN_METRIC_STATUS: 'warn_metric_status' as PostType,
    REMINDER: 'reminder' as PostType,
};

export default {
    POST_CHUNK_SIZE: 60,
    POST_DELETED: 'DELETED',
    SYSTEM_MESSAGE_PREFIX: 'system_',
    SYSTEM_AUTO_RESPONDER: 'system_auto_responder',
    POST_TYPES: PostTypes,
    MESSAGE_TYPES: {
        POST: 'post',
        COMMENT: 'comment',
    },
    MAX_PREV_MSGS: 100,
    POST_COLLAPSE_TIMEOUT: 1000 * 60 * 5, // five minutes
    IGNORE_POST_TYPES: [
        PostTypes.ADD_REMOVE,
        PostTypes.ADD_TO_CHANNEL,
        PostTypes.CHANNEL_DELETED,
        PostTypes.CHANNEL_UNARCHIVED,
        PostTypes.JOIN_LEAVE,
        PostTypes.JOIN_CHANNEL,
        PostTypes.LEAVE_CHANNEL,
        PostTypes.REMOVE_FROM_CHANNEL,
        PostTypes.JOIN_TEAM,
        PostTypes.LEAVE_TEAM,
        PostTypes.ADD_TO_TEAM,
        PostTypes.REMOVE_FROM_TEAM,
    ],
    USER_ACTIVITY_POST_TYPES: [
        PostTypes.ADD_TO_CHANNEL,
        PostTypes.JOIN_CHANNEL,
        PostTypes.LEAVE_CHANNEL,
        PostTypes.REMOVE_FROM_CHANNEL,
        PostTypes.ADD_TO_TEAM,
        PostTypes.JOIN_TEAM,
        PostTypes.LEAVE_TEAM,
        PostTypes.REMOVE_FROM_TEAM,
    ],
};
