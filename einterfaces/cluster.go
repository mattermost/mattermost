// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type ClusterInterface interface {
	StartInterNodeCommunication()
	StopInterNodeCommunication()
	GetClusterInfos() []*model.ClusterInfo
	GetClusterStats() ([]*model.ClusterStats, *model.AppError)
	ClearSessionCacheForUser(userId string)
	InvalidateCacheForUser(userId string)
	InvalidateCacheForChannel(channelId string)
	InvalidateCacheForChannelByName(teamId, name string)
	InvalidateCacheForChannelMembers(channelId string)
	InvalidateCacheForChannelMembersNotifyProps(channelId string)
	InvalidateCacheForChannelPosts(channelId string)
	InvalidateCacheForWebhook(webhookId string)
	InvalidateCacheForReactions(postId string)
	Publish(event *model.WebSocketEvent)
	UpdateStatus(status *model.Status)
	GetLogs(page, perPage int) ([]string, *model.AppError)
	GetClusterId() string
	ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError
	InvalidateAllCaches() *model.AppError
}

var theClusterInterface ClusterInterface

func RegisterClusterInterface(newInterface ClusterInterface) {
	theClusterInterface = newInterface
}

func GetClusterInterface() ClusterInterface {
	return theClusterInterface
}
