// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type ClusterEvent string

const (
	ClusterEventNone                                        ClusterEvent = "none"
	ClusterEventPublish                                     ClusterEvent = "publish"
	ClusterEventUpdateStatus                                ClusterEvent = "update_status"
	ClusterEventInvalidateAllCaches                         ClusterEvent = "inv_all_caches"
	ClusterEventInvalidateCacheForReactions                 ClusterEvent = "inv_reactions"
	ClusterEventInvalidateCacheForChannelMembersNotifyProps ClusterEvent = "inv_channel_members_notify_props"
	ClusterEventInvalidateCacheForChannelByName             ClusterEvent = "inv_channel_name"
	ClusterEventInvalidateCacheForChannel                   ClusterEvent = "inv_channel"
	ClusterEventInvalidateCacheForChannelGuestCount         ClusterEvent = "inv_channel_guest_count"
	ClusterEventInvalidateCacheForUser                      ClusterEvent = "inv_user"
	ClusterEventInvalidateWebConnCacheForUser               ClusterEvent = "inv_user_teams"
	ClusterEventClearSessionCacheForUser                    ClusterEvent = "clear_session_user"
	ClusterEventInvalidateCacheForRoles                     ClusterEvent = "inv_roles"
	ClusterEventInvalidateCacheForRolePermissions           ClusterEvent = "inv_role_permissions"
	ClusterEventInvalidateCacheForProfileByIds              ClusterEvent = "inv_profile_ids"
	ClusterEventInvalidateCacheForAllProfiles               ClusterEvent = "inv_all_profiles"
	ClusterEventInvalidateCacheForProfileInChannel          ClusterEvent = "inv_profile_in_channel"
	ClusterEventInvalidateCacheForSchemes                   ClusterEvent = "inv_schemes"
	ClusterEventInvalidateCacheForFileInfos                 ClusterEvent = "inv_file_infos"
	ClusterEventInvalidateCacheForWebhooks                  ClusterEvent = "inv_webhooks"
	ClusterEventInvalidateCacheForEmojisById                ClusterEvent = "inv_emojis_by_id"
	ClusterEventInvalidateCacheForEmojisIdByName            ClusterEvent = "inv_emojis_id_by_name"
	ClusterEventInvalidateCacheForChannelFileCount          ClusterEvent = "inv_channel_file_count"
	ClusterEventInvalidateCacheForChannelPinnedpostsCounts  ClusterEvent = "inv_channel_pinnedposts_counts"
	ClusterEventInvalidateCacheForChannelMemberCounts       ClusterEvent = "inv_channel_member_counts"
	ClusterEventInvalidateCacheForChannelsMemberCount       ClusterEvent = "inv_channels_member_count"
	ClusterEventInvalidateCacheForLastPosts                 ClusterEvent = "inv_last_posts"
	ClusterEventInvalidateCacheForLastPostTime              ClusterEvent = "inv_last_post_time"
	ClusterEventInvalidateCacheForPostsUsage                ClusterEvent = "inv_posts_usage"
	ClusterEventInvalidateCacheForTeams                     ClusterEvent = "inv_teams"
	ClusterEventClearSessionCacheForAllUsers                ClusterEvent = "inv_all_user_sessions"
	ClusterEventInstallPlugin                               ClusterEvent = "install_plugin"
	ClusterEventRemovePlugin                                ClusterEvent = "remove_plugin"
	ClusterEventPluginEvent                                 ClusterEvent = "plugin_event"
	ClusterEventInvalidateCacheForTermsOfService            ClusterEvent = "inv_terms_of_service"
	ClusterEventBusyStateChanged                            ClusterEvent = "busy_state_change"
	// Note: if you are adding a new event, please also add it in the slice of
	// m.ClusterEventMap in metrics/metrics.go file.

	// Gossip communication
	ClusterGossipEventRequestGetLogs                = "gossip_request_get_logs"
	ClusterGossipEventResponseGetLogs               = "gossip_response_get_logs"
	ClusterGossipEventRequestGenerateSupportPacket  = "gossip_request_generate_support_packet"
	ClusterGossipEventResponseGenerateSupportPacket = "gossip_response_generate_support_packet"
	ClusterGossipEventRequestGetClusterStats        = "gossip_request_cluster_stats"
	ClusterGossipEventResponseGetClusterStats       = "gossip_response_cluster_stats"
	ClusterGossipEventRequestGetPluginStatuses      = "gossip_request_plugin_statuses"
	ClusterGossipEventResponseGetPluginStatuses     = "gossip_response_plugin_statuses"
	ClusterGossipEventRequestSaveConfig             = "gossip_request_save_config"
	ClusterGossipEventResponseSaveConfig            = "gossip_response_save_config"
	ClusterGossipEventRequestWebConnCount           = "gossip_request_webconn_count"
	ClusterGossipEventResponseWebConnCount          = "gossip_response_webconn_count"
	ClusterGossipEventRequestWSQueues               = "gossip_request_ws_queues"
	ClusterGossipEventResponseWSQueues              = "gossip_response_ws_queues"

	// SendTypes for ClusterMessage.
	ClusterSendBestEffort = "best_effort"
	ClusterSendReliable   = "reliable"
)

type ClusterMessage struct {
	Event            ClusterEvent      `json:"event"`
	SendType         string            `json:"-"`
	WaitForAllToSend bool              `json:"-"`
	Data             []byte            `json:"data,omitempty"`
	Props            map[string]string `json:"props,omitempty"`
}
