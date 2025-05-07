// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type ClusterMessageHandler func(msg *model.ClusterMessage)

type ClusterInterface interface {
	StartInterNodeCommunication()
	StopInterNodeCommunication()
	RegisterClusterMessageHandler(event model.ClusterEvent, crm ClusterMessageHandler)
	GetClusterId() string
	IsLeader() bool
	// HealthScore returns a number which is indicative of how well an instance is meeting
	// the soft real-time requirements of the protocol. Lower numbers are better,
	// and zero means "totally healthy".
	HealthScore() int
	GetMyClusterInfo() *model.ClusterInfo
	GetClusterInfos() []*model.ClusterInfo
	SendClusterMessage(msg *model.ClusterMessage)
	SendClusterMessageToNode(nodeID string, msg *model.ClusterMessage) error
	NotifyMsg(buf []byte)
	GetClusterStats(rctx request.CTX) ([]*model.ClusterStats, *model.AppError)
	GetLogs(ctx request.CTX, page, perPage int) ([]string, *model.AppError)
	QueryLogs(rctx request.CTX, page, perPage int) (map[string][]string, *model.AppError)
	GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) (map[string][]model.FileData, error)
	GetPluginStatuses() (model.PluginStatuses, *model.AppError)
	ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError
	// WebConnCountForUser returns the number of active webconn connections
	// for a given userID.
	WebConnCountForUser(userID string) (int, *model.AppError)
	// GetWSQueues returns the necessary websocket queues from a cluster for a given
	// connectionID and sequence number.
	GetWSQueues(userID, connectionID string, seqNum int64) (map[string]*model.WSQueues, error)
}
