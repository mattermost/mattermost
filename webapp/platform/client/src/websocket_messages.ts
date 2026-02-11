// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmarkWithFileInfo, UpdateChannelBookmarkResponse} from '@mattermost/types/channel_bookmarks';
import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel, ChannelMembership, ChannelType} from '@mattermost/types/channels';
import type {Limits, Subscription} from '@mattermost/types/cloud';
import type {ClientConfig, ClientLicense} from '@mattermost/types/config';
import type {Draft} from '@mattermost/types/drafts';
import type {CustomEmoji} from '@mattermost/types/emojis';
import type {Group, GroupMember as GroupMemberType} from '@mattermost/types/groups';
import type {OpenDialogRequest} from '@mattermost/types/integrations';
import type {PluginManifest, PluginStatus} from '@mattermost/types/plugins';
import type {Post, PostAcknowledgement as PostAcknowledgementType} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {Reaction} from '@mattermost/types/reactions';
import type {Role} from '@mattermost/types/roles';
import type {ScheduledPost as ScheduledPostType} from '@mattermost/types/schedule_post';
import type {Team as TeamType, TeamMembership} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import type {WebSocketEvents} from './websocket_events';
import type {BaseWebSocketMessage, JsonEncodedValue} from './websocket_message';

// WebSocket-related messages

export type Hello = BaseWebSocketMessage<WebSocketEvents.Hello, {
    server_version: string;
    connection_id: string;
    server_hostname?: string;
}>;

export type AuthenticationChallenge = BaseWebSocketMessage<WebSocketEvents.AuthenticationChallenge, unknown>;

export type Response = BaseWebSocketMessage<WebSocketEvents.Response>;

// Post, reactions, and acknowledgement messages

export type Posted = BaseWebSocketMessage<WebSocketEvents.Posted, {
    channel_type: ChannelType;
    channel_display_name: string;
    channel_name: string;
    sender_name: string;
    team_id: string;
    set_online: boolean;
    otherFile?: boolean;
    image?: boolean;
    post: JsonEncodedValue<Post>;

    /**
     * If the current user is mentioned by this post, this field will contain the ID of that user. Otherwise,
     * it will be empty.
     */
    mentions?: JsonEncodedValue<string[]>;

    /**
     * If the current user is following this post, this field will contain the ID of that user. Otherwise,
     * it will be empty.
     */
    followers?: JsonEncodedValue<string[]>;

    should_ack?: boolean;
}>;

export type PostEdited = BaseWebSocketMessage<WebSocketEvents.PostEdited, {
    post: JsonEncodedValue<Post>;
}>;

export type PostDeleted = BaseWebSocketMessage<WebSocketEvents.PostDeleted, {
    post: JsonEncodedValue<Post>;

    /** The user ID of the user who deleted the post, only sent to admin users. */
    delete_by?: string;
}>;

export type PostUnread = BaseWebSocketMessage<WebSocketEvents.PostUnread, {
    msg_count: number;
    msg_count_root: number;
    mention_count: number;
    mention_count_root: number;
    urgent_mention_count: number;
    last_viewed_at: number;
    post_id: string;
}>;

export type BurnOnReadPostRevealed = BaseWebSocketMessage<WebSocketEvents.BurnOnReadPostRevealed, {
    post?: string | Post;
    recipients?: string[];
}>;

export type BurnOnReadPostBurned = BaseWebSocketMessage<WebSocketEvents.BurnOnReadPostBurned, {
    post_id: string;
}>;

export type BurnOnReadPostAllRevealed = BaseWebSocketMessage<WebSocketEvents.BurnOnReadPostAllRevealed, {
    post_id: string;
    sender_expire_at: number;
}>;

export type EphemeralPost = BaseWebSocketMessage<WebSocketEvents.EphemeralMessage, {
    post: JsonEncodedValue<Post>;
}>;

export type PostReaction =
    BaseWebSocketMessage<WebSocketEvents.ReactionAdded | WebSocketEvents.ReactionRemoved, {
        reaction: JsonEncodedValue<Reaction>;
    }>;

export type PostAcknowledgement =
    BaseWebSocketMessage<WebSocketEvents.PostAcknowledgementAdded | WebSocketEvents.PostAcknowledgementRemoved, {
        acknowledgement: JsonEncodedValue<PostAcknowledgementType>;
    }>;

export type PostDraft =
    BaseWebSocketMessage<WebSocketEvents.DraftCreated | WebSocketEvents.DraftUpdated | WebSocketEvents.DraftDeleted, {
        draft: JsonEncodedValue<Draft>;
    }>;

export type PersistentNotificationTriggered =
    BaseWebSocketMessage<WebSocketEvents.PersistentNotificationTriggered, {
        post: JsonEncodedValue<Post>;
        channel_type: ChannelType;
        channel_display_name: string;
        channel_name: string;
        sender_name: string;
        team_id: string;
        otherFile?: boolean;
        image?: boolean;
        mentions?: JsonEncodedValue<string[]>;
    }>;

export type ScheduledPost =
    BaseWebSocketMessage<WebSocketEvents.ScheduledPostCreated | WebSocketEvents.ScheduledPostUpdated | WebSocketEvents.ScheduledPostDeleted, {
        scheduledPost: JsonEncodedValue<ScheduledPostType>;
    }>;

// Thread messages

export type ThreadUpdated = BaseWebSocketMessage<WebSocketEvents.ThreadUpdated, {
    thread: JsonEncodedValue<UserThread>;

    previous_unread_mentions?: number;
    previous_unread_replies?: number;
}>;

export type ThreadFollowedChanged = BaseWebSocketMessage<WebSocketEvents.ThreadFollowChanged, {
    thread_id: string;
    state: boolean;
    reply_count: number;
}>;

export type ThreadReadChanged = BaseWebSocketMessage<WebSocketEvents.ThreadReadChanged, {
    thread_id?: string;
    timestamp: number;
    unread_mentions?: number;
    unread_replies?: number;
    previous_unread_mentions?: number;
    previous_unread_replies?: number;
    channel_id?: string;
}>;

// Channel and channel member messages

export type ChannelCreated = BaseWebSocketMessage<WebSocketEvents.ChannelCreated, {
    channel_id: string;
    team_id: string;
}>;

export type ChannelUpdated = BaseWebSocketMessage<WebSocketEvents.ChannelUpdated, {

    // Normally, the channel field is sent, except in some cases where a shared channel is updated in which case
    // the channel_id field is used.

    channel?: JsonEncodedValue<Channel>;
    channel_id?: string;
}>;

export type ChannelConverted = BaseWebSocketMessage<WebSocketEvents.ChannelConverted, {
    channel_id: string;
}>;

export type ChannelSchemeUpdated = BaseWebSocketMessage<WebSocketEvents.ChannelSchemeUpdated>;

export type ChannelDeleted = BaseWebSocketMessage<WebSocketEvents.ChannelDeleted, {
    channel_id: string;
    delete_at: number;
}>;

export type ChannelRestored = BaseWebSocketMessage<WebSocketEvents.ChannelRestored, {
    channel_id: string;
}>;

export type DirectChannelCreated = BaseWebSocketMessage<WebSocketEvents.DirectAdded, {
    creator_id: string;
    teammate_id: string;
}>;

export type GroupChannelCreated = BaseWebSocketMessage<WebSocketEvents.GroupAdded, {
    teammate_ids: JsonEncodedValue<string[]>;
}>;

export type UserAddedToChannel = BaseWebSocketMessage<WebSocketEvents.UserAdded, {
    user_id: string;
    team_id: string;
}>;

export type UserRemovedFromChannel = BaseWebSocketMessage<WebSocketEvents.UserRemoved, {

    /** The user ID of the user that was removed from the channel. It isn't sent to the user who was removed. */
    user_id?: string;

    /** The ID of the channel that the user was removed from. It's only sent to the user who was removed. */
    channel_id?: string;

    remover_id: string;
}>;

export type ChannelMemberUpdated = BaseWebSocketMessage<WebSocketEvents.ChannelMemberUpdated, {
    channelMember: JsonEncodedValue<ChannelMembership>;
}>;

export type MultipleChannelsViewed = BaseWebSocketMessage<WebSocketEvents.MultipleChannelsViewed, {
    channel_times: Record<string, number>;
}>;

// Channel bookmark messages

export type ChannelBookmarkCreated = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkCreated, {
    bookmark: JsonEncodedValue<ChannelBookmarkWithFileInfo>;
}>;

export type ChannelBookmarkUpdated = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkUpdated, {
    bookmarks: JsonEncodedValue<UpdateChannelBookmarkResponse>;
}>;

export type ChannelBookmarkDeleted = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkDeleted, {
    bookmark: JsonEncodedValue<ChannelBookmarkWithFileInfo>;
}>;

export type ChannelBookmarkSorted = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkSorted, {
    bookmarks: JsonEncodedValue<ChannelBookmarkWithFileInfo[]>;
}>;

// Team and team member messages

export type Team =
    BaseWebSocketMessage<WebSocketEvents.UpdateTeam | WebSocketEvents.DeleteTeam | WebSocketEvents.RestoreTeam, {
        team: JsonEncodedValue<TeamType>;
    }>;

export type UserAddedToTeam = BaseWebSocketMessage<WebSocketEvents.AddedToTeam, {
    team_id: string;
    user_id: string;
}>;

export type UserRemovedFromTeam = BaseWebSocketMessage<WebSocketEvents.LeaveTeam, {
    user_id: string;
    team_id: string;
}>;

export type UpdateTeamScheme = BaseWebSocketMessage<WebSocketEvents.UpdateTeamScheme, {
    team: JsonEncodedValue<Team>;
}>;

export type TeamMemberRoleUpdated = BaseWebSocketMessage<WebSocketEvents.MemberRoleUpdated, {
    member: JsonEncodedValue<TeamMembership>;
}>;

// User and status messages

export type NewUser = BaseWebSocketMessage<WebSocketEvents.NewUser, {
    user_id: string;
}>;

export type UserUpdated = BaseWebSocketMessage<WebSocketEvents.UserUpdated, {

    /** This user may be missing sensitive data based on if the recipient is that user or an admin. */
    user: UserProfile;
}>;

export type UserActivationStatusChanged = BaseWebSocketMessage<WebSocketEvents.UserActivationStatusChange>;

export type UserRoleUpdated = BaseWebSocketMessage<WebSocketEvents.UserRoleUpdated, {
    user_id: string;
    roles: string;
}>;

export type StatusChanged = BaseWebSocketMessage<WebSocketEvents.StatusChange, {
    status: UserStatus['status'];
    user_id: string;
}>;

export type Typing = BaseWebSocketMessage<WebSocketEvents.Typing, {
    parent_id: string;
    user_id: string;
}>;

// Group-related messages

export type ReceivedGroup = BaseWebSocketMessage<WebSocketEvents.ReceivedGroup, {
    group: JsonEncodedValue<Group>;
}>;

export type GroupAssociatedToTeam =
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroupAssociatedToTeam | WebSocketEvents.ReceivedGroupNotAssociatedToTeam, {
        group_id: string;
    }>;

export type GroupAssociatedToChannel =
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroupAssociatedToChannel | WebSocketEvents.ReceivedGroupNotAssociatedToChannel, {
        group_id: string;
    }>;

export type GroupMember =
    BaseWebSocketMessage<WebSocketEvents.GroupMemberAdded | WebSocketEvents.GroupMemberDeleted, {
        group_member: JsonEncodedValue<GroupMemberType>;
    }>;

// Preference messages

export type PreferenceChanged = BaseWebSocketMessage<WebSocketEvents.PreferenceChanged, {
    preference: JsonEncodedValue<PreferenceType>;
}>;

export type PreferencesChanged =
    BaseWebSocketMessage<WebSocketEvents.PreferencesChanged | WebSocketEvents.PreferencesDeleted, {
        preferences: JsonEncodedValue<PreferenceType[]>;
    }>;

// Channel sidebar messages

export type SidebarCategoryCreated = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryCreated, {
    category_id: string;
}>;

export type SidebarCategoryUpdated = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryUpdated, {
    updatedCategories: JsonEncodedValue<ChannelCategory[]>;
}>;

export type SidebarCategoryDeleted = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryDeleted, {
    category_id: string;
}>;

export type SidebarCategoryOrderUpdated = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryOrderUpdated, {
    order: string[];
}>;

// Emoji messages

export type EmojiAdded = BaseWebSocketMessage<WebSocketEvents.EmojiAdded, {
    emoji: JsonEncodedValue<Omit<CustomEmoji, 'category'>>;
}>;

// Role messages

export type RoleUpdated = BaseWebSocketMessage<WebSocketEvents.RoleUpdated, {
    role: JsonEncodedValue<Role>;
}>;

// Configuration and license messages

export type ConfigChanged = BaseWebSocketMessage<WebSocketEvents.ConfigChanged, {
    config: ClientConfig;
}>;

export type GuestsDeactivated = BaseWebSocketMessage<WebSocketEvents.GuestsDeactivated>;

export type LicenseChanged = BaseWebSocketMessage<WebSocketEvents.LicenseChanged, {
    license: ClientLicense;
}>;

export type CloudSubscriptionChanged = BaseWebSocketMessage<WebSocketEvents.CloudSubscriptionChanged, {
    limits?: Limits;
    subscription: Subscription;
}>;

export type FirstAdminVisitMarketplaceStatusReceived =
    BaseWebSocketMessage<WebSocketEvents.FirstAdminVisitMarketplaceStatusReceived, {
        firstAdminVisitMarketplaceStatus: JsonEncodedValue<boolean>;
    }>;

export type HostedCustomerSignupProgressUpdated =
    BaseWebSocketMessage<WebSocketEvents.HostedCustomerSignupProgressUpdated, {
        progress: string;
    }>

// Custom properties messages

export type CPAFieldCreated = BaseWebSocketMessage<WebSocketEvents.CPAFieldCreated, {
    field: PropertyField;
}>;

export type CPAFieldUpdated = BaseWebSocketMessage<WebSocketEvents.CPAFieldUpdated, {
    field: PropertyField;
    delete_values: boolean;
}>;

export type CPAFieldDeleted = BaseWebSocketMessage<WebSocketEvents.CPAFieldDeleted, {
    field_id: string;
}>;

export type CPAValuesUpdated = BaseWebSocketMessage<WebSocketEvents.CPAValuesUpdated, {
    user_id: string;
    values: Array<PropertyValue<unknown>>;
}>;

// Content flagging messages

export type ContentFlaggingReportValueUpdated =
    BaseWebSocketMessage<WebSocketEvents.ContentFlaggingReportValueUpdated, {
        property_values: JsonEncodedValue<Array<PropertyValue<unknown>>>;
        target_id: string;
    }>;

// Recap messages

export type RecapUpdated = BaseWebSocketMessage<WebSocketEvents.RecapUpdated, {
    recap_id: string;
}>;

// Post translation messages

export type PostTranslationUpdated = BaseWebSocketMessage<WebSocketEvents.PostTranslationUpdated, {
    language: string;
    object_id: string;
    src_lang: string;
    state: 'ready' | 'skipped' | 'processing' | 'unavailable';
    translation: string;
}>;

// Plugin and integration messages

export type Plugin = BaseWebSocketMessage<WebSocketEvents.PluginEnabled | WebSocketEvents.PluginDisabled, {
    manifest: PluginManifest;
}>;

export type PluginStatusesChanged = BaseWebSocketMessage<WebSocketEvents.PluginStatusesChanged, {
    plugin_statuses: PluginStatus[];
}>;

export type OpenDialog = BaseWebSocketMessage<WebSocketEvents.OpenDialog, {
    dialog: JsonEncodedValue<OpenDialogRequest>;
}>;

/**
 * Unknown is used for WebSocket messages which don't come from Mattermost itself. It's primarily intended for use
 * by plugins.
 */
export type Unknown = BaseWebSocketMessage<string, unknown>;
