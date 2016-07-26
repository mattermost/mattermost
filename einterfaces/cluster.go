// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type ClusterInterface interface {
	StartInterNodeCommunication()
	StopInterNodeCommunication()
	RemoveAllSessionsForUserId(userId string)
	InvalidateCacheForUser(userId string)
	InvalidateCacheForChannel(channelId string)
	Publish(event *model.WebSocketEvent)
	UpdateStatus(status *model.Status)
}

var theClusterInterface ClusterInterface

func RegisterClusterInterface(newInterface ClusterInterface) {
	theClusterInterface = newInterface
}

func GetClusterInterface() ClusterInterface {
	return theClusterInterface
}
