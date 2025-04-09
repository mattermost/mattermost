// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelType} from './channels';
import type {CustomEmoji} from './emojis';
import type {FileInfo} from './files';
import type {Reaction} from './reactions';
import type {TeamType} from './teams';
import type {UserProfile} from './users';
import {
    type RelationOneToOne,
    type RelationOneToMany,
    type IDMappedObjects,
} from './utilities';

export type PostType = 'system_add_remove' |
'system_add_to_channel' |
'system_add_to_team' |
'system_channel_deleted' |
'system_channel_restored' |
'system_displayname_change' |
'system_convert_channel' |
'system_ephemeral' |
'system_header_change' |
'system_join_channel' |
'system_join_leave' |
'system_leave_channel' |
'system_purpose_change' |
'system_remove_from_channel' |
'system_combined_user_activity' |
'system_fake_parent_deleted' |
'system_generic' |
'reminder' |
'system_wrangler' |
'';

export type PostEmbedType = 'image' | 'link' | 'message_attachment' | 'opengraph' | 'permalink';

export type PostEmbed = {
    type: PostEmbedType;
    url: string;
    data?: OpenGraphMetadata | PostPreviewMetadata;
};

export type PostImage = {
    format: string;
    frameCount: number;
    height: number;
    width: number;
};

export type PostAcknowledgement = {
    post_id: Post['id'];
    user_id: UserProfile['id'];
    acknowledged_at: number;
}

export type PostPriorityMetadata = {
    priority: PostPriority|'';
    requested_ack?: boolean;
    persistent_notifications?: boolean;
}

export type PostMetadata = {
    embeds: PostEmbed[];
    emojis: CustomEmoji[];
    files: FileInfo[];
    images: Record<string, PostImage>;
    reactions?: Reaction[];
    priority?: PostPriorityMetadata;
    acknowledgements?: PostAcknowledgement[];
};

export type Post = {
    id: string;
    create_at: number;
    update_at: number;
    edit_at: number;
    delete_at: number;
    is_pinned: boolean;
    user_id: string;
    channel_id: string;
    root_id: string;
    original_id: string;
    message: string;
    type: PostType;
    props: Record<string, unknown>;
    hashtags: string;
    pending_post_id: string;
    reply_count: number;
    file_ids?: string[];
    metadata: PostMetadata;
    failed?: boolean;
    user_activity_posts?: Post[];
    state?: PostState;
    filenames?: string[];
    last_reply_at?: number;
    participants?: any; //Array<UserProfile | UserProfile['id']>;
    message_source?: string;
    is_following?: boolean;
    exists?: boolean;
    remote_id?: string;
};

export type PostState = 'DELETED';

export enum PostPriority {
    URGENT = 'urgent',
    IMPORTANT = 'important',
}

export type PostList = {
    order: Array<Post['id']>;
    posts: Record<string, Post>;
    next_post_id: string;
    prev_post_id: string;
    first_inaccessible_post_time: number;
};

export type PaginatedPostList = PostList & {
    has_next: boolean;
}

export type PostSearchResults = PostList & {
    matches: RelationOneToOne<Post, string[]>;
};

export type PostOrderBlock = {
    order: string[];
    recent?: boolean;
    oldest?: boolean;
};

export type MessageHistory = {
    messages: string[];
    index: {
        post: number;
        comment: number;
    };
};

export type PostsState = {
    posts: IDMappedObjects<Post>;
    postsReplies: {[x in Post['id']]: number};
    postsInChannel: Record<string, PostOrderBlock[]>;
    postsInThread: RelationOneToMany<Post, Post>;
    reactions: RelationOneToOne<Post, Record<string, Reaction>>;
    openGraph: RelationOneToOne<Post, Record<string, OpenGraphMetadata>>;
    pendingPostIds: string[];
    postEditHistory: Post[];
    currentFocusedPostId: string;
    messagesHistory: MessageHistory;
    limitedViews: {
        channels: Record<Channel['id'], number>;
        threads: Record<Post['root_id'], number>;
    };
    acknowledgements: RelationOneToOne<Post, Record<UserProfile['id'], number>>;
};

export declare type OpenGraphMetadataImage = {
    secure_url?: string;
    url: string;
    type?: string;
    height?: number;
    width?: number;
}

export declare type OpenGraphMetadata = {
    type?: string;
    title?: string;
    description?: string;
    site_name?: string;
    url?: string;
    images: OpenGraphMetadataImage[];
};

export declare type PostPreviewMetadata = {
    post_id: string;
    post?: Post;
    channel_display_name: string;
    team_name: string;
    channel_type: ChannelType;
    channel_id: string;
};

export declare type PostsUsageResponse = {
    count: number;
};

export declare type FilesUsageResponse = {
    bytes: number;
};

export declare type TeamsUsageResponse = {
    active: number;
    cloud_archived: number;
};

export type PostAnalytics = {
    channel_id: string;
    post_id: string;
    user_actual_id: string;
    root_id: string;
    priority?: PostPriority|'';
    requested_ack?: boolean;
    persistent_notifications?: boolean;
}
export type ActivityEntry = {
    postType: Post['type'];
    actorId: string[];
    userIds: string[];
    usernames: string[];
}

export type PostInfo = {
    channel_id: string;
    channel_type: ChannelType;
    channel_display_name: string;
    has_joined_channel: boolean;
    team_id: string;
    team_type: TeamType;
    team_display_name: string;
    has_joined_team: boolean;
}

export type NotificationStatus = 'error' | 'not_sent' | 'unsupported' | 'success';
export type NotificationResult = {
    status: NotificationStatus;
    reason?: string;
    data?: string;
}
