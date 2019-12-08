// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
)

type FakeClusterInterface struct {
	clusterMessageHandler einterfaces.ClusterMessageHandler
	messages              []*model.ClusterMessage
}

func (c *FakeClusterInterface) StartInterNodeCommunication() {}

func (c *FakeClusterInterface) StopInterNodeCommunication() {}

func (c *FakeClusterInterface) RegisterClusterMessageHandler(event string, crm einterfaces.ClusterMessageHandler) {
	c.clusterMessageHandler = crm
}

func (c *FakeClusterInterface) GetClusterId() string { return "" }

func (c *FakeClusterInterface) IsLeader() bool { return false }

func (c *FakeClusterInterface) GetMyClusterInfo() *model.ClusterInfo { return nil }

func (c *FakeClusterInterface) GetClusterInfos() []*model.ClusterInfo { return nil }

func (c *FakeClusterInterface) SendClusterMessage(message *model.ClusterMessage) {
	c.messages = append(c.messages, message)
}

func (c *FakeClusterInterface) NotifyMsg(buf []byte) {}

func (c *FakeClusterInterface) GetClusterStats() ([]*model.ClusterStats, *model.AppError) {
	return nil, nil
}

func (c *FakeClusterInterface) GetLogs(page, perPage int) ([]string, *model.AppError) {
	return []string{}, nil
}

func (c *FakeClusterInterface) ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError {
	return nil
}

func (c *FakeClusterInterface) SendClearRoleCacheMessage() {
	if c.clusterMessageHandler != nil {
		c.clusterMessageHandler(&model.ClusterMessage{
			Event: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES,
		})
	}
}

func (c *FakeClusterInterface) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return nil, nil
}

func (c *FakeClusterInterface) GetMessages() []*model.ClusterMessage {
	return c.messages
}

func (c *FakeClusterInterface) ClearMessages() {
	c.messages = nil
}
