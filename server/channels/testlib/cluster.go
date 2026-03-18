// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type FakeClusterInterface struct {
	clusterMessageHandler einterfaces.ClusterMessageHandler
	mut                   sync.RWMutex
	messages              []*model.ClusterMessage
}

func (c *FakeClusterInterface) StartInterNodeCommunication() {}

func (c *FakeClusterInterface) StopInterNodeCommunication() {}

func (c *FakeClusterInterface) RegisterClusterMessageHandler(event model.ClusterEvent, crm einterfaces.ClusterMessageHandler) {
	c.clusterMessageHandler = crm
}

func (c *FakeClusterInterface) HealthScore() int {
	return 0
}

func (c *FakeClusterInterface) GetClusterId() string { return "" }

func (c *FakeClusterInterface) IsLeader() bool { return false }

func (c *FakeClusterInterface) GetMyClusterInfo() *model.ClusterInfo { return nil }

func (c *FakeClusterInterface) GetClusterInfos() ([]*model.ClusterInfo, error) { return nil, nil }

func (c *FakeClusterInterface) SendClusterMessage(message *model.ClusterMessage) {
	c.mut.Lock()
	defer c.mut.Unlock()
	c.messages = append(c.messages, message)
}

func (c *FakeClusterInterface) SendClusterMessageToNode(nodeID string, message *model.ClusterMessage) error {
	c.mut.Lock()
	defer c.mut.Unlock()
	c.messages = append(c.messages, message)
	return nil
}

func (c *FakeClusterInterface) NotifyMsg(buf []byte) {}

func (c *FakeClusterInterface) GetClusterStats(rctx request.CTX) ([]*model.ClusterStats, *model.AppError) {
	return nil, nil
}

func (c *FakeClusterInterface) GetLogs(rctx request.CTX, page, perPage int) ([]string, *model.AppError) {
	return []string{}, nil
}

func (c *FakeClusterInterface) QueryLogs(rctx request.CTX, page, perPage int) (map[string][]string, *model.AppError) {
	return make(map[string][]string), nil
}

func (c *FakeClusterInterface) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) (map[string][]model.FileData, error) {
	return nil, nil
}

func (c *FakeClusterInterface) ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError {
	return nil
}

func (c *FakeClusterInterface) SendClearRoleCacheMessage() {
	if c.clusterMessageHandler != nil {
		c.clusterMessageHandler(&model.ClusterMessage{
			Event: model.ClusterEventInvalidateCacheForRoles,
		})
	}
}

func (c *FakeClusterInterface) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return nil, nil
}

func (c *FakeClusterInterface) GetMessages() []*model.ClusterMessage {
	c.mut.RLock()
	defer c.mut.RUnlock()
	return c.messages
}

func (c *FakeClusterInterface) SelectMessages(filterCond func(message *model.ClusterMessage) bool) []*model.ClusterMessage {
	c.mut.RLock()
	defer c.mut.RUnlock()

	filteredMessages := []*model.ClusterMessage{}
	for _, msg := range c.messages {
		if filterCond(msg) {
			filteredMessages = append(filteredMessages, msg)
		}
	}
	return filteredMessages
}

func (c *FakeClusterInterface) ClearMessages() {
	c.mut.Lock()
	defer c.mut.Unlock()
	c.messages = nil
}

func (c *FakeClusterInterface) WebConnCountForUser(userID string) (int, *model.AppError) {
	return 0, nil
}

func (c *FakeClusterInterface) GetWSQueues(userID, connectionID string, seqNum int64) (map[string]*model.WSQueues, error) {
	return nil, nil
}
