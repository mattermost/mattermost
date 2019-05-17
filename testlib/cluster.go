// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testlib

import (
	"github.com/hashicorp/memberlist"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
)

type FakeClusterInterface struct {
	clusterMessageHandler einterfaces.ClusterMessageHandler
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

func (c *FakeClusterInterface) SendClusterMessage(cluster *model.ClusterMessage) {}

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
	c.clusterMessageHandler(&model.ClusterMessage{
		Event: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES,
	})
}

func (c *FakeClusterInterface) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return nil, nil
}

func (c *FakeClusterInterface) GetBroadcasts(overhead, limit int) [][]byte {
	return [][]byte{}
}

func (c *FakeClusterInterface) LocalState(join bool) []byte {
	return []byte{}
}

func (c *FakeClusterInterface) MergeRemoteState(buf []byte, join bool) {}

func (c *FakeClusterInterface) NodeMeta(limit int) []byte {
	return []byte{}
}

func (c *FakeClusterInterface) NotifyJoin(node *memberlist.Node)   {}
func (c *FakeClusterInterface) NotifyLeave(node *memberlist.Node)  {}
func (c *FakeClusterInterface) NotifyUpdate(node *memberlist.Node) {}
