// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmarkWithFileInfo, UpdateChannelBookmarkResponse} from '@mattermost/types/channel_bookmarks';
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
import type {UserThread} from '@mattermost/types/threads';
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
    GroupMemberDeleted = 'group_member_deleted',
    GroupMemberAdded = 'group_member_add',
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
    PostAcknowledgementAdded = 'post_acknowledgement_added',
    PostAcknowledgementRemoved = 'post_acknowledgement_removed',
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
    HelloMessage |
    AuthenticationChallengeMessage |
    ResponseMessage |

    PostedMessage |
    PostEditedMessage |
    PostDeletedMessage |
    PostUnreadMessage |
    EphemeralPostMessage |
    PostReactionMessage |
    PostAcknowledgementMessage |
    PostDraftMessage |
    PersistentNotificationTriggeredMessage |
    ScheduledPostMessage |

    ThreadUpdatedMessage |
    ThreadFollowedChangedMessage |
    ThreadReadChangedMessage |

    ChannelCreatedMessage |
    ChannelUpdatedMessage |
    ChannelConvertedMessage |
    ChannelSchemeUpdatedMessage |
    ChannelDeletedMessage |
    ChannelRestoredMessage |
    DirectChannelCreatedMessage |
    GroupChannelCreatedMessage |
    UserAddedToChannelMessage |
    UserRemovedFromChannelMessage |
    ChannelMemberUpdatedMessage |
    MultipleChannelsViewedMessage |

    ChannelBookmarkCreatedMessage |
    ChannelBookmarkUpdatedMessage |
    ChannelBookmarkDeletedMessage |
    ChannelBookmarkSortedMessage |

    TeamMessage |
    UpdateTeamSchemeMessage |
    UserAddedToTeamMessage |
    UserRemovedFromTeamMessage |
    TeamMemberRoleUpdatedMessage |

    NewUserMessage |
    UserUpdatedMessage |
    UserActivationStatusChangedMessage |
    UserRoleUpdatedMessage |
    StatusChangedMessage |
    TypingMessage |

    ReceivedGroupMessage |
    GroupAssociatedToTeamMessage |
    GroupAssociatedToChannelMesasge |
    GroupMemberMessage |

    PreferenceChangedMessage |
    PreferencesChangedMessage |

    SidebarCategoryCreatedMessage |
    SidebarCategoryUpdatedMessage |
    SidebarCategoryDeletedMessage |
    SidebarCategoryOrderUpdatedMessage|

    EmojiAddedMessage |

    RoleUpdatedMessage |

    ConfigChangedMessage |
    GuestsDeactivatedMessage |
    LicenseChangedMessage |
    CloudSubscriptionChangedMessage |
    FirstAdminVisitMarketplaceStatusReceivedMessage |
    HostedCustomerSignupProgressUpdatedMessage |

    CPAFieldCreatedMessage |
    CPAFieldUpdatedMessage |
    CPAFieldDeletedMessage |
    CPAValuesUpdatedMessage |

    ContentFlaggingReportValueUpdatedMessage |

    PluginMessage |
    PluginStatusesChangedMessage |
    OpenDialogMessage |

    BaseWebSocketMessage<WebSocketEvents.PresenceIndicator, unknown> |
    BaseWebSocketMessage<WebSocketEvents.PostedNotifyAck, unknown>
);

// WebSocket-related messages

export type HelloMessage = BaseWebSocketMessage<WebSocketEvents.Hello, {
    server_version: string;
    connection_id: string;
    server_hostname?: string;
}>;

export type AuthenticationChallengeMessage = BaseWebSocketMessage<WebSocketEvents.AuthenticationChallenge, unknown>;

export type ResponseMessage = BaseWebSocketMessage<WebSocketEvents.Response>;

// Post, reactions, and acknowledgement messages

export type PostedMessage = BaseWebSocketMessage<WebSocketEvents.Posted, {
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

export type PostEditedMessage = BaseWebSocketMessage<WebSocketEvents.PostEdited, {
    post: JsonEncodedValue<Post>;
}>;

export type PostDeletedMessage = BaseWebSocketMessage<WebSocketEvents.PostDeleted, {
    post: JsonEncodedValue<Post>;

    /** The user ID of the user who deleted the post, only sent to admin users. */
    delete_by?: string;
}>;

export type PostUnreadMessage = BaseWebSocketMessage<WebSocketEvents.PostUnread, {
    msg_count: number;
    msg_count_root: number;
    mention_count: number;
    mention_count_root: number;
    urgent_mention_count: number;
    last_viewed_at: number;
    post_id: string;
}>;

export type EphemeralPostMessage = BaseWebSocketMessage<WebSocketEvents.EphemeralMessage, {
    post: JsonEncodedValue<Post>;
}>;

export type PostReactionMessage =
    BaseWebSocketMessage<WebSocketEvents.ReactionAdded | WebSocketEvents.ReactionRemoved, {
        reaction: JsonEncodedValue<Reaction>;
    }>;

export type PostAcknowledgementMessage =
    BaseWebSocketMessage<WebSocketEvents.PostAcknowledgementAdded | WebSocketEvents.PostAcknowledgementRemoved, {
        acknowledgement: JsonEncodedValue<PostAcknowledgement>;
    }>;

export type PostDraftMessage =
    BaseWebSocketMessage<WebSocketEvents.DraftCreated | WebSocketEvents.DraftUpdated | WebSocketEvents.DraftDeleted, {
        draft: JsonEncodedValue<Draft>;
    }>;

export type PersistentNotificationTriggeredMessage =
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

export type ScheduledPostMessage =
    BaseWebSocketMessage<WebSocketEvents.ScheduledPostCreated | WebSocketEvents.ScheduledPostUpdated | WebSocketEvents.ScheduledPostDeleted, {
        scheduledPost: JsonEncodedValue<ScheduledPost>;
    }>;

// Thread messages

export type ThreadUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.ThreadUpdated, {
    thread: JsonEncodedValue<UserThread>;

    previous_unread_mentions?: number;
    previous_unread_replies?: number;
}>;

export type ThreadFollowedChangedMessage = BaseWebSocketMessage<WebSocketEvents.ThreadFollowChanged, {
    thread_id: string;
    state: boolean;
    reply_count: number;
}>;

export type ThreadReadChangedMessage = BaseWebSocketMessage<WebSocketEvents.ThreadReadChanged, {
    thread_id?: string;
    timestamp: number;
    unread_mentions?: number;
    unread_replies?: number;
    previous_unread_mentions?: number;
    previous_unread_replies?: number;
    channel_id?: string;
}>;

// Channel and channel member messages

export type ChannelCreatedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelCreated, {
    channel_id: string;
    team_id: string;
}>;

export type ChannelUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelUpdated, {

    // Normally, the channel field is sent, except in some cases where a shared channel is updated in which case
    // the channel_id field is used.

    channel?: JsonEncodedValue<Channel>;
    channel_id?: string;
}>;

export type ChannelConvertedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelConverted, {
    channel_id: string;
}>;

export type ChannelSchemeUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelSchemeUpdated>;

export type ChannelDeletedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelDeleted, {
    channel_id: string;
    delete_at: number;
}>;

export type ChannelRestoredMessage = BaseWebSocketMessage<WebSocketEvents.ChannelRestored, {
    channel_id: string;
}>;

export type DirectChannelCreatedMessage = BaseWebSocketMessage<WebSocketEvents.DirectAdded, {
    creator_id: string;
    teammate_id: string;
}>;

export type GroupChannelCreatedMessage = BaseWebSocketMessage<WebSocketEvents.GroupAdded, {
    teammate_ids: JsonEncodedValue<string[]>;
}>;

export type UserAddedToChannelMessage = BaseWebSocketMessage<WebSocketEvents.UserAdded, {
    user_id: string;
    team_id: string;
}>;

export type UserRemovedFromChannelMessage = BaseWebSocketMessage<WebSocketEvents.UserRemoved, {

    /** The user ID of the user that was removed from the channel. It isn't sent to the user who was removed. */
    user_id?: string;

    /** The ID of the channel that the user was removed from. It's only sent to the user who was removed. */
    channel_id?: string;

    remover_id: string;
}>;

export type ChannelMemberUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelMemberUpdated, {
    channelMember: JsonEncodedValue<ChannelMembership>;
}>;

export type MultipleChannelsViewedMessage = BaseWebSocketMessage<WebSocketEvents.MultipleChannelsViewed, {
    channel_times: Record<string, number>;
}>;

// Channel bookmark messages

export type ChannelBookmarkCreatedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkCreated, {
    bookmark: JsonEncodedValue<ChannelBookmarkWithFileInfo>;
}>;

export type ChannelBookmarkUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkUpdated, {
    bookmarks: JsonEncodedValue<UpdateChannelBookmarkResponse>;
}>;

export type ChannelBookmarkDeletedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkDeleted, {
    bookmark: JsonEncodedValue<ChannelBookmarkWithFileInfo>;
}>;

export type ChannelBookmarkSortedMessage = BaseWebSocketMessage<WebSocketEvents.ChannelBookmarkSorted, {
    bookmarks: JsonEncodedValue<ChannelBookmarkWithFileInfo[]>;
}>;

// Team and team member messages

export type TeamMessage =
    BaseWebSocketMessage<WebSocketEvents.UpdateTeam | WebSocketEvents.DeleteTeam | WebSocketEvents.RestoreTeam, {
        team: JsonEncodedValue<Team>;
    }>;

export type UserAddedToTeamMessage = BaseWebSocketMessage<WebSocketEvents.AddedToTeam, {
    team_id: string;
    user_id: string;
}>;

export type UserRemovedFromTeamMessage = BaseWebSocketMessage<WebSocketEvents.LeaveTeam, {
    user_id: string;
    team_id: string;
}>;

export type UpdateTeamSchemeMessage = BaseWebSocketMessage<WebSocketEvents.UpdateTeamScheme, {
    team: JsonEncodedValue<Team>;
}>;

export type TeamMemberRoleUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.MemberRoleUpdated, {
    member: JsonEncodedValue<TeamMembership>;
}>;

// User and status messages

export type NewUserMessage = BaseWebSocketMessage<WebSocketEvents.NewUser, {
    user_id: string;
}>;

export type UserUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.UserUpdated, {

    /** This user may be missing sensitive data based on if the recipient is that user or an admin. */
    user: UserProfile;
}>;

export type UserActivationStatusChangedMessage = BaseWebSocketMessage<WebSocketEvents.UserActivationStatusChange>;

export type UserRoleUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.UserRoleUpdated, {
    user_id: string;
    roles: string;
}>;

export type StatusChangedMessage = BaseWebSocketMessage<WebSocketEvents.StatusChange, {
    status: UserStatus['status'];
    user_id: string;
}>;

export type TypingMessage = BaseWebSocketMessage<WebSocketEvents.Typing, {
    parent_id: string;
    user_id: string;
}>;

// Group-related messages

export type ReceivedGroupMessage = BaseWebSocketMessage<WebSocketEvents.ReceivedGroup, {
    group: JsonEncodedValue<Group>;
}>;

export type GroupAssociatedToTeamMessage =
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroupAssociatedToTeam | WebSocketEvents.ReceivedGroupNotAssociatedToTeam, {
        group_id: string;
    }>;

export type GroupAssociatedToChannelMessage =
    BaseWebSocketMessage<WebSocketEvents.ReceivedGroupAssociatedToChannel | WebSocketEvents.ReceivedGroupNotAssociatedToChannel, {
        group_id: string;
    }>;

export type GroupMemberMessage =
    BaseWebSocketMessage<WebSocketEvents.GroupMemberAdded | WebSocketEvents.GroupMemberDeleted, {
        group_member: JsonEncodedValue<GroupMember>;
    }>;

// Preference messages

export type PreferenceChangedMessage = BaseWebSocketMessage<WebSocketEvents.PreferenceChanged, {
    preference: JsonEncodedValue<PreferenceType>;
}>;

export type PreferencesChangedMessage =
    BaseWebSocketMessage<WebSocketEvents.PreferencesChanged | WebSocketEvents.PreferencesDeleted, {
        preferences: JsonEncodedValue<PreferenceType[]>;
    }>;

// Channel sidebar messages

export type SidebarCategoryCreatedMessage = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryCreated, {
    category_id: string;
}>;

export type SidebarCategoryUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryUpdated, {
    updatedCategories: JsonEncodedValue<ChannelCategory[]>;
}>;

export type SidebarCategoryDeletedMessage = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryDeleted, {
    category_id: string;
}>;

export type SidebarCategoryOrderUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.SidebarCategoryOrderUpdated, {
    order: string[];
}>;

// Emoji messages

export type EmojiAddedMessage = BaseWebSocketMessage<WebSocketEvents.EmojiAdded, {
    emoji: JsonEncodedValue<Omit<CustomEmoji, 'category'>>;
}>;

// Role messages

export type RoleUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.RoleUpdated, {
    role: JsonEncodedValue<Role>;
}>;

// Configuration and license messages

export type ConfigChangedMessage = BaseWebSocketMessage<WebSocketEvents.ConfigChanged, {
    config: ClientConfig;
}>;

export type GuestsDeactivatedMessage = BaseWebSocketMessage<WebSocketEvents.GuestsDeactivated>;

export type LicenseChangedMessage = BaseWebSocketMessage<WebSocketEvents.LicenseChanged, {
    license: ClientLicense;
}>;

export type CloudSubscriptionChangedMessage = BaseWebSocketMessage<WebSocketEvents.CloudSubscriptionChanged, {
    limits?: Limits;
    subscription: Subscription;
}>;

export type FirstAdminVisitMarketplaceStatusReceivedMessage =
    BaseWebSocketMessage<WebSocketEvents.FirstAdminVisitMarketplaceStatusReceived, {
        firstAdminVisitMarketplaceStatus: JsonEncodedValue<boolean>;
    }>;

export type HostedCustomerSignupProgressUpdatedMessage =
    BaseWebSocketMessage<WebSocketEvents.HostedCustomerSignupProgressUpdated, {
        progress: string;
    }>

// Custom properties messages

export type CPAFieldCreatedMessage = BaseWebSocketMessage<WebSocketEvents.CPAFieldCreated, {
    field: PropertyField;
}>;

export type CPAFieldUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.CPAFieldUpdated, {
    field: PropertyField;
    delete_values: boolean;
}>;

export type CPAFieldDeletedMessage = BaseWebSocketMessage<WebSocketEvents.CPAFieldDeleted, {
    field_id: string;
}>;

export type CPAValuesUpdatedMessage = BaseWebSocketMessage<WebSocketEvents.CPAValuesUpdated, {
    user_id: string;
    values: Array<PropertyValue<unknown>>;
}>;

// Content flagging messages

export type ContentFlaggingReportValueUpdatedMessage =
    BaseWebSocketMessage<WebSocketEvents.ContentFlaggingReportValueUpdated, {
        property_values: JsonEncodedValue<Array<PropertyValue<unknown>>>;
        target_id: string;
    }>;

// Plugin and integration messages

export type PluginMessage = BaseWebSocketMessage<WebSocketEvents.PluginEnabled | WebSocketEvents.PluginDisabled, {
    manifest: PluginManifest;
}>;

export type PluginStatusesChangedMessage = BaseWebSocketMessage<WebSocketEvents.PluginStatusesChanged, {
    plugin_statuses: PluginStatus[];
}>;

export type OpenDialogMessage = BaseWebSocketMessage<WebSocketEvents.OpenDialog, {
    dialog: JsonEncodedValue<OpenDialogRequest>;
}>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type JsonEncodedValue<T> = string;

type BaseWebSocketMessage<Event extends WebSocketEvents, T = Record<string, never>> = {
    event: Event;
    data: T;
    broadcast: WebSocketBroadcast;
    seq: number;
}

export type WebSocketBroadcast = {
    omit_users: Record<string, boolean>;
    user_id: string;
    channel_id: string;
    team_id: string;
}

/**
 * UnknownWebSocketMessage is used for WebSocket messages which don't come from Mattermost itself. It's primarily
 * intended for use by plugins.
 */
export type UnknownWebSocketMessage = BaseWebSocketMessage<string, unknown>;
