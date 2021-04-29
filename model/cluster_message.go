// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	CLUSTER_EVENT_PUBLISH                                           = "publish"
	CLUSTER_EVENT_UPDATE_STATUS                                     = "update_status"
	CLUSTER_EVENT_INVALIDATE_ALL_CACHES                             = "inv_all_caches"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS                    = "inv_reactions"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOK                      = "inv_webhook"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_POSTS                = "inv_channel_posts"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS = "inv_channel_members_notify_props"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS              = "inv_channel_members"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME              = "inv_channel_name"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL                      = "inv_channel"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_GUEST_COUNT          = "inv_channel_guest_count"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER                         = "inv_user"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER_TEAMS                   = "inv_user_teams"
	CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER                      = "clear_session_user"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES                        = "inv_roles"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLE_PERMISSIONS             = "inv_role_permissions"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_BY_IDS               = "inv_profile_ids"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_IN_CHANNEL           = "inv_profile_in_channel"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES                      = "inv_schemes"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_FILE_INFOS                   = "inv_file_infos"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOKS                     = "inv_webhooks"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_BY_ID                 = "inv_emojis_by_id"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_ID_BY_NAME            = "inv_emojis_id_by_name"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_PINNEDPOSTS_COUNTS   = "inv_channel_pinnedposts_counts"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBER_COUNTS        = "inv_channel_member_counts"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POSTS                   = "inv_last_posts"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POST_TIME               = "inv_last_post_time"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TEAMS                        = "inv_teams"
	CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_ALL_USERS                 = "inv_all_user_sessions"
	CLUSTER_EVENT_INSTALL_PLUGIN                                    = "install_plugin"
	CLUSTER_EVENT_REMOVE_PLUGIN                                     = "remove_plugin"
	CLUSTER_EVENT_PLUGIN_EVENT                                      = "plugin_event"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TERMS_OF_SERVICE             = "inv_terms_of_service"
	CLUSTER_EVENT_BUSY_STATE_CHANGED                                = "busy_state_change"

	// Gossip communication
	CLUSTER_GOSSIP_EVENT_REQUEST_GET_LOGS             = "gossip_request_get_logs"
	CLUSTER_GOSSIP_EVENT_RESPONSE_GET_LOGS            = "gossip_response_get_logs"
	CLUSTER_GOSSIP_EVENT_REQUEST_GET_CLUSTER_STATS    = "gossip_request_cluster_stats"
	CLUSTER_GOSSIP_EVENT_RESPONSE_GET_CLUSTER_STATS   = "gossip_response_cluster_stats"
	CLUSTER_GOSSIP_EVENT_REQUEST_GET_PLUGIN_STATUSES  = "gossip_request_plugin_statuses"
	CLUSTER_GOSSIP_EVENT_RESPONSE_GET_PLUGIN_STATUSES = "gossip_response_plugin_statuses"
	CLUSTER_GOSSIP_EVENT_REQUEST_SAVE_CONFIG          = "gossip_request_save_config"
	CLUSTER_GOSSIP_EVENT_RESPONSE_SAVE_CONFIG         = "gossip_response_save_config"

	// SendTypes for ClusterMessage.
	CLUSTER_SEND_BEST_EFFORT = "best_effort"
	CLUSTER_SEND_RELIABLE    = "reliable"
)

type ClusterMessage struct {
	Event            string            `json:"event"`
	SendType         string            `json:"-"`
	WaitForAllToSend bool              `json:"-"`
	Data             string            `json:"data,omitempty"`
	Props            map[string]string `json:"props,omitempty"`
}

func (o *ClusterMessage) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func ClusterMessageFromJson(data io.Reader) *ClusterMessage {
	var o *ClusterMessage
	json.NewDecoder(data).Decode(&o)
	return o
}
