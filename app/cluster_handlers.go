// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
)

func RegisterAllClusterMessageHandlers() {
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_PUBLISH, ClusterPublishHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_UPDATE_STATUS, ClusterUpdateStatusHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_ALL_CACHES, ClusterInvalidateAllCachesHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOK, ClusterInvalidateCacheForWebhookHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_POSTS, ClusterInvalidateCacheForChannelPostsHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS, ClusterInvalidateCacheForChannelMembersNotifyPropHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS, ClusterInvalidateCacheForChannelMembersHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME, ClusterInvalidateCacheForChannelByNameHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL, ClusterInvalidateCacheForChannelHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER, ClusterInvalidateCacheForUserHandler)
	einterfaces.GetClusterInterface().RegisterClusterMessageHandler(model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER, ClusterClearSessionCacheForUserHandler)

}

func ClusterPublishHandler(msg *model.ClusterMessage) {
	event := model.WebSocketEventFromJson(strings.NewReader(msg.Data))
	PublishSkipClusterSend(event)
}

func ClusterUpdateStatusHandler(msg *model.ClusterMessage) {
	status := model.StatusFromJson(strings.NewReader(msg.Data))
	AddStatusCacheSkipClusterSend(status)
}

func ClusterInvalidateAllCachesHandler(msg *model.ClusterMessage) {
	InvalidateAllCachesSkipSend()
}

func ClusterInvalidateCacheForWebhookHandler(msg *model.ClusterMessage) {
	InvalidateCacheForWebhookSkipClusterSend(msg.Data)
}

func ClusterInvalidateCacheForChannelPostsHandler(msg *model.ClusterMessage) {
	InvalidateCacheForChannelPostsSkipClusterSend(msg.Data)
}

func ClusterInvalidateCacheForChannelMembersNotifyPropHandler(msg *model.ClusterMessage) {
	InvalidateCacheForChannelMembersNotifyPropsSkipClusterSend(msg.Data)
}

func ClusterInvalidateCacheForChannelMembersHandler(msg *model.ClusterMessage) {
	InvalidateCacheForChannelMembersSkipClusterSend(msg.Data)
}

func ClusterInvalidateCacheForChannelByNameHandler(msg *model.ClusterMessage) {
	InvalidateCacheForChannelByNameSkipClusterSend(msg.Props["id"], msg.Props["name"])
}

func ClusterInvalidateCacheForChannelHandler(msg *model.ClusterMessage) {
	InvalidateCacheForChannelSkipClusterSend(msg.Data)
}

func ClusterInvalidateCacheForUserHandler(msg *model.ClusterMessage) {
	InvalidateCacheForUserSkipClusterSend(msg.Data)
}

func ClusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	ClearSessionCacheForUserSkipClusterSend(msg.Data)
}
