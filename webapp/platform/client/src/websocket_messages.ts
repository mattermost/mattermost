// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmarkWithFileInfo} from '@mattermost/types/channel_bookmarks';
import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel, ChannelMembership, ChannelType} from '@mattermost/types/channels';
import type {Limits, Subscription} from '@mattermost/types/cloud';
import type {ClientConfig, ClientLicense} from '@mattermost/types/config';
import type {Draft} from '@mattermost/types/drafts';
import type {CustomEmoji} from '@mattermost/types/emojis';
import type {Group, GroupMember} from '@mattermost/types/groups';
import type {OpenDialogRequest} from '@mattermost/types/integrations';
import type {PluginManifest, PluginStatus} from '@mattermost/types/plugins';
import type {Post, PostAcknowledgement} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {Reaction} from '@mattermost/types/reactions';
import type {Role} from '@mattermost/types/roles';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {ThreadResponse} from '@mattermost/types/threads';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

export const enum WebSocketEvents {
    Typing = 'typing',
    Posted = 'posted',
    PostEdited = 'post_edited',
    PostDeleted = 'post_deleted',
    PostUnread = 'post_unread',
    ChannelConverted = 'channel_converted',
    ChannelCreated = 'channel_created',
    ChannelDeleted = 'channel_deleted',
    ChannelRestored = 'channel_restored',
    ChannelUpdated = 'channel_updated',
    ChannelMemberUpdated = 'channel_member_updated',
    ChannelSchemeUpdated = 'channel_scheme_updated',
    DirectAdded = 'direct_added',
    GroupAdded = 'group_added',
    NewUser = 'new_user',
    AddedToTeam = 'added_to_team',
    LeaveTeam = 'leave_team',
    UpdateTeam = 'update_team',
    DeleteTeam = 'delete_team',
    RestoreTeam = 'restore_team', // This isn't currently used by the web app
    UpdateTeamScheme = 'update_team_scheme',
    UserAdded = 'user_added',
    UserUpdated = 'user_updated',
    UserRoleUpdated = 'user_role_updated',
    MemberRoleUpdated = 'memberrole_updated',
    UserRemoved = 'user_removed',
    PreferenceChanged = 'preference_changed',
    PreferencesChanged = 'preferences_changed',
    PreferencesDeleted = 'preferences_deleted',
    EphemeralMessage = 'ephemeral_message',
    StatusChange = 'status_change',
    Hello = 'hello',
    AuthenticationChallenge = 'authentication_challenge', // This isn't currently used by the web app, and it's a message that would be sent from a client to the server
    ReactionAdded = 'reaction_added',
    ReactionRemoved = 'reaction_removed',
    Response = 'response',
    EmojiAdded = 'emoji_added',
    MultipleChannelsViewed = 'multiple_channels_viewed',
    PluginStatusesChanged = 'plugin_statuses_changed',
    PluginEnabled = 'plugin_enabled',
    PluginDisabled = 'plugin_disabled',
    RoleUpdated = 'role_updated',
    LicenseChanged = 'license_changed',
    ConfigChanged = 'config_changed',
    OpenDialog = 'open_dialog',
    GuestsDeactivated = 'guests_deactivated', // This isn't currently used by the web app
    UserActivationStatusChange = 'user_activation_status_change',
    ReceivedGroup = 'received_group',
    ReceivedGroupAssociatedToTeam = 'received_group_associated_to_team',
    ReceivedGroupNotAssociatedToTeam = 'received_group_not_associated_to_team',
    ReceivedGroupAssociatedToChannel = 'received_group_associated_to_channel',
    ReceivedGroupNotAssociatedToChannel = 'received_group_not_associated_to_channel',
    GroupMemberDelete = 'group_member_deleted',
    GroupMemberAdd = 'group_member_add',
    SidebarCategoryCreated = 'sidebar_category_created',
    SidebarCategoryUpdated = 'sidebar_category_updated',
    SidebarCategoryDeleted = 'sidebar_category_deleted',
    SidebarCategoryOrderUpdated = 'sidebar_category_order_updated',
    CloudSubscriptionChanged = 'cloud_subscription_changed',
    ThreadUpdated = 'thread_updated',
    ThreadFollowChanged = 'thread_follow_changed',
    ThreadReadChanged = 'thread_read_changed',
    FirstAdminVisitMarketplaceStatusReceived = 'first_admin_visit_marketplace_status_received',
    DraftCreated = 'draft_created',
    DraftUpdated = 'draft_updated',
    DraftDeleted = 'draft_deleted',
    AcknowledgementAdded = 'post_acknowledgement_added',
    AcknowledgementRemoved = 'post_acknowledgement_removed',
    PersistentNotificationTriggered = 'persistent_notification_triggered',
    HostedCustomerSignupProgressUpdated = 'hosted_customer_signup_progress_updated',
    ChannelBookmarkCreated = 'channel_bookmark_created',
    ChannelBookmarkUpdated = 'channel_bookmark_updated',
    ChannelBookmarkDeleted = 'channel_bookmark_deleted',
    ChannelBookmarkSorted = 'channel_bookmark_sorted',
    PresenceIndicator = 'presence',
    PostedNotifyAck = 'posted_notify_ack', // This isn't currently used by the web app
    ScheduledPostCreated = 'scheduled_post_created',
    ScheduledPostUpdated = 'scheduled_post_updated',
    ScheduledPostDeleted = 'scheduled_post_deleted',
    CPAFieldCreated = 'custom_profile_attributes_field_created',
    CPAFieldUpdated = 'custom_profile_attributes_field_updated',
    CPAFieldDeleted = 'custom_profile_attributes_field_deleted',
    CPAValuesUpdated = 'custom_profile_attributes_values_updated',
    ContentFlaggingReportValueUpdated = 'content_flagging_report_value_updated',
}

export type WebSocketMessage = (
    BaseWebSocketMessage<WebSocketEvents.Typing, {
        parent_id: string;
        user_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.Posted, {
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
        mentioned?: JsonEncodedValue<string[]>;

        /**
         * If the current user is following this post, this field will contain the ID of that user. Otherwise,
         * it will be empty.
         */
        followers?: JsonEncodedValue<string[]>;

        should_ack?: boolean;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PostEdited, {
        post: JsonEncodedValue<Post>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PostDeleted, {
        post: JsonEncodedValue<Post>;

        /** The user ID of the user who deleted the post, only sent to admin users. */
        delete_by?: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PostUnread, {
        msg_count: number;
        msg_count_root: number;
        mention_count: number;
        mention_count_root: number;
        urgent_mention_count: number;
        last_viewed_at: number;
        post_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelConverted, {
        channel_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelCreated, {
        channel_id: string;
        team_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelDeleted, {
        channel_id: string;
        delete_at: number;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelRestored, {
        channel_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelUpdated, {

        // Normally, the channel field is sent, except in some cases where a shared channel is updated in which case
        // the channel_id field is used.

        channel?: JsonEncodedValue<Channel>;
        channel_id?: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelMemberUpdated, {
        channelMember: JsonEncodedValue<ChannelMembership>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelSchemeUpdated> |
    BaseWebSocketMessage<WebSocketEvents.DirectAdded, {
        creator_id: string;
        teammate_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.GroupAdded, {
        teammate_ids: JsonEncodedValue<string[]>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.NewUser, {
        user_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.AddedToTeam, {
        team_id: string;
        user_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.LeaveTeam, {
        user_id: string;
        team_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.UpdateTeam | WebSocketEvents.DeleteTeam | WebSocketEvents.RestoreTeam, {
        team: JsonEncodedValue<Team>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.UpdateTeamScheme, {
        team: JsonEncodedValue<Team>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.UserAdded, {
        user_id: string;
        team_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.UserUpdated, {

        /** This user may be missing sensitive data based on if the recipient is that user or an admin. */
        user: UserProfile;
    }> |
    BaseWebSocketMessage<WebSocketEvents.UserRoleUpdated, {
        user_id: string;
        roles: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.MemberRoleUpdated, {
        member: JsonEncodedValue<TeamMembership>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.UserRemoved, {

        /** The user ID of the user that was removed from the channel. It isn't sent to the user who was removed. */
        user_id?: string;

        /** The ID of the channel that the user was removed from. It's only sent to the user who was removed. */
        channel_id?: string;

        remover_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PreferenceChanged, {
        preference: JsonEncodedValue<PreferenceType>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PreferencesChanged | WebSocketEvents.PreferencesDeleted, {
        preferences: JsonEncodedValue<PreferenceType[]>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.EphemeralMessage, {
        post: JsonEncodedValue<Post>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.StatusChange, {
        status: UserStatus['status'];
        user_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.Hello, {
        server_version: string;
        connection_id: string;
        server_hostname?: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.AuthenticationChallenge, unknown> |
    BaseWebSocketMessage<WebSocketEvents.ReactionAdded | WebSocketEvents.ReactionRemoved, {
        reaction: JsonEncodedValue<Reaction>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.Response> |
    BaseWebSocketMessage<WebSocketEvents.EmojiAdded, {
        emoji: JsonEncodedValue<Omit<CustomEmoji, 'category'>>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.MultipleChannelsViewed, {
        channel_times: Record<string, number>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PluginStatusesChanged, {
        plugin_statuses: PluginStatus[];
    }> |
    BaseWebSocketMessage<WebSocketEvents.PluginEnabled | WebSocketEvents.PluginDisabled, {
        manifest: PluginManifest;
    }> |
    BaseWebSocketMessage<WebSocketEvents.RoleUpdated, {
        role: JsonEncodedValue<Role>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.LicenseChanged, {
        license: ClientLicense;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ConfigChanged, {
        config: ClientConfig;
    }> |
    BaseWebSocketMessage<WebSocketEvents.OpenDialog, {
        dialog: JsonEncodedValue<OpenDialogRequest>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.GuestsDeactivated> |
    BaseWebSocketMessage<WebSocketEvents.UserActivationStatusChange> |
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroup, {
        group: JsonEncodedValue<Group>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroupAssociatedToTeam | WebSocketEvents.ReceivedGroupNotAssociatedToTeam, {
        group_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroupAssociatedToChannel | WebSocketEvents.ReceivedGroupNotAssociatedToChannel, {
        group_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.GroupMemberAdd | WebSocketEvents.GroupMemberDelete, {
        groupMember: JsonEncodedValue<GroupMember>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.SidebarCategoryCreated, {
        category_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.SidebarCategoryUpdated, {
        updatedCategories: JsonEncodedValue<ChannelCategory[]>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.SidebarCategoryDeleted, {
        category_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.SidebarCategoryOrderUpdated, {
        order: string[];
    }> |
    BaseWebSocketMessage<WebSocketEvents.CloudSubscriptionChanged, {
        limits?: Limits;
        subscription: Subscription;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ThreadUpdated, {
        thread: JsonEncodedValue<ThreadResponse>;

        previous_unread_mentions?: number;
        previous_unread_replies?: number;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ThreadFollowChanged, {
        thread_id: string;
        state: boolean;
        reply_count: number;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ThreadReadChanged, {
        thread_id?: string;
        timestamp: number;
        unread_mentions?: number;
        unread_replies?: number;
        previous_unread_mentions?: number;
        previous_unread_replies?: number;
        channel_id?: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.FirstAdminVisitMarketplaceStatusReceived, {
        firstAdminVisitMarketplaceStatus: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.DraftCreated | WebSocketEvents.DraftUpdated | WebSocketEvents.DraftDeleted, {
        draft: JsonEncodedValue<Draft>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.AcknowledgementAdded | WebSocketEvents.AcknowledgementRemoved, {
        acknowledgement: JsonEncodedValue<PostAcknowledgement>;
    }> |
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
    }> |
    BaseWebSocketMessage<WebSocketEvents.HostedCustomerSignupProgressUpdated, {
        progress: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkCreated | WebSocketEvents.ChannelBookmarkDeleted, {
        bookmark: JsonEncodedValue<ChannelBookmarkWithFileInfo>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkUpdated, {

        // This field is misnamed, but it matches the name used by the server.
        bookmarks: JsonEncodedValue<ChannelBookmarkWithFileInfo>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkSorted, {
        bookmarks: JsonEncodedValue<ChannelBookmarkWithFileInfo[]>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.PresenceIndicator, unknown> |
    BaseWebSocketMessage<WebSocketEvents.PostedNotifyAck, unknown> |
    BaseWebSocketMessage<WebSocketEvents.ScheduledPostCreated | WebSocketEvents.ScheduledPostUpdated | WebSocketEvents.ScheduledPostDeleted, {
        scheduledPost: JsonEncodedValue<ScheduledPost>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.CPAFieldCreated, {
        field: PropertyField;
    }> |
    BaseWebSocketMessage<WebSocketEvents.CPAFieldUpdated, {
        field: PropertyField;
        delete_values: boolean;
    }> |
    BaseWebSocketMessage<WebSocketEvents.CPAFieldDeleted, {
        field_id: string;
    }> |
    BaseWebSocketMessage<WebSocketEvents.CPAValuesUpdated, {
        user_id: string;
        values: Array<PropertyValue<unknown>>;
    }> |
    BaseWebSocketMessage<WebSocketEvents.ContentFlaggingReportValueUpdated, {
        property_values: JsonEncodedValue<Array<PropertyValue<unknown>>>;
        target_id: string;
    }>
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type JsonEncodedValue<T> = string;

type BaseWebSocketMessage<Event extends WebSocketEvents, T = Record<string, never>> = {
    event: Event;
    data: T;
    broadcast: WebSocketBroadcast;
    seq: number;
}

// export type LegacyWebSocketMessage = {
//     event: string;
//     data: any;
//     broadcast: WebSocketBroadcast;
//     seq: number;
// }

export type WebSocketBroadcast = {
    omit_users: Record<string, boolean>;
    user_id: string;
    channel_id: string;
    team_id: string;
}
