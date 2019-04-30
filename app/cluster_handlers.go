// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/model"
)

func (a *App) RegisterAllClusterMessageHandlers() {
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_PUBLISH, a.ClusterPublishHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_UPDATE_STATUS, a.ClusterUpdateStatusHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_ALL_CACHES, a.ClusterInvalidateAllCachesHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOK, a.ClusterInvalidateCacheForWebhookHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_POSTS, a.ClusterInvalidateCacheForChannelPostsHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS, a.ClusterInvalidateCacheForChannelMembersNotifyPropHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS, a.ClusterInvalidateCacheForChannelMembersHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME, a.ClusterInvalidateCacheForChannelByNameHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL, a.ClusterInvalidateCacheForChannelHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER, a.ClusterInvalidateCacheForUserHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER_TEAMS, a.ClusterInvalidateCacheForUserTeamsHandler)
	a.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER, a.ClusterClearSessionCacheForUserHandler)
}

func (a *App) ClusterPublishHandler(msg *model.ClusterMessage) {
	event := model.WebSocketEventFromJson(strings.NewReader(msg.Data))
	a.PublishSkipClusterSend(event)
}

func (a *App) ClusterUpdateStatusHandler(msg *model.ClusterMessage) {
	status := model.StatusFromJson(strings.NewReader(msg.Data))
	a.AddStatusCacheSkipClusterSend(status)
}

func (a *App) ClusterInvalidateAllCachesHandler(msg *model.ClusterMessage) {
	a.InvalidateAllCachesSkipSend()
}

func (a *App) ClusterInvalidateCacheForWebhookHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForWebhookSkipClusterSend(msg.Data)
}

func (a *App) ClusterInvalidateCacheForChannelPostsHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForChannelPostsSkipClusterSend(msg.Data)
}

func (a *App) ClusterInvalidateCacheForChannelMembersNotifyPropHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForChannelMembersNotifyPropsSkipClusterSend(msg.Data)
}

func (a *App) ClusterInvalidateCacheForChannelMembersHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForChannelMembersSkipClusterSend(msg.Data)
}

func (a *App) ClusterInvalidateCacheForChannelByNameHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForChannelByNameSkipClusterSend(msg.Props["id"], msg.Props["name"])
}

func (a *App) ClusterInvalidateCacheForChannelHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForChannelSkipClusterSend(msg.Data)
}

func (a *App) ClusterInvalidateCacheForUserHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForUserSkipClusterSend(msg.Data)
}

func (a *App) ClusterInvalidateCacheForUserTeamsHandler(msg *model.ClusterMessage) {
	a.InvalidateCacheForUserTeamsSkipClusterSend(msg.Data)
}

func (a *App) ClusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	a.ClearSessionCacheForUserSkipClusterSend(msg.Data)
}
