// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

func TestBusySet(t *testing.T) {
	cluster := &ClusterMock{Busy: &Busy{}, t: t}
	busy := NewBusy(cluster)

	isNotBusy := func() bool {
		return !busy.IsBusy()
	}

	require.False(t, busy.IsBusy())

	busy.Set(5 * time.Second)
	require.True(t, busy.IsBusy())
	require.True(t, compareBusyState(t, busy, cluster.Busy))

	// should automatically expire after 5s.
	require.Eventually(t, isNotBusy, time.Second*15, time.Millisecond*100)
	// allow a moment for cluster to sync.
	require.Eventually(t, func() bool { return compareBusyState(t, busy, cluster.Busy) }, time.Second*15, time.Millisecond*20)

	// test set after auto expiry.
	busy.Set(time.Second * 30)
	require.True(t, busy.IsBusy())
	require.True(t, compareBusyState(t, busy, cluster.Busy))
	expire := busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Second*10).Unix())

	// test extending existing expiry
	busy.Set(time.Minute * 5)
	require.True(t, busy.IsBusy())
	require.True(t, compareBusyState(t, busy, cluster.Busy))
	expire = busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Minute*2).Unix())

	busy.Clear()
	require.False(t, busy.IsBusy())
	require.True(t, compareBusyState(t, busy, cluster.Busy))
}

func TestBusyExpires(t *testing.T) {
	cluster := &ClusterMock{Busy: &Busy{}, t: t}
	busy := NewBusy(cluster)

	isNotBusy := func() bool {
		return !busy.IsBusy()
	}

	// get expiry before it is set
	expire := busy.Expires()
	// should be time.Time zero value
	require.Equal(t, time.Time{}.Unix(), expire.Unix())

	// get expiry after it is set
	busy.Set(time.Minute * 5)
	expire = busy.Expires()
	require.Greater(t, expire.Unix(), time.Now().Add(time.Minute*2).Unix())
	require.True(t, compareBusyState(t, busy, cluster.Busy))

	// get expiry after clear
	busy.Clear()
	expire = busy.Expires()
	// should be time.Time zero value
	require.Equal(t, time.Time{}.Unix(), expire.Unix())
	require.True(t, compareBusyState(t, busy, cluster.Busy))

	// get expiry after auto-expire
	busy.Set(time.Millisecond * 100)
	require.Eventually(t, isNotBusy, time.Second*5, time.Millisecond*20)
	expire = busy.Expires()
	// should be time.Time zero value
	require.Equal(t, time.Time{}.Unix(), expire.Unix())
	// allow a moment for cluster to sync
	require.Eventually(t, func() bool { return compareBusyState(t, busy, cluster.Busy) }, time.Second*15, time.Millisecond*20)
}

func TestBusyRace(t *testing.T) {
	cluster := &ClusterMock{Busy: &Busy{}, t: t}
	busy := NewBusy(cluster)

	busy.Set(500 * time.Millisecond)

	// We are sleeping in order to let the race trigger.
	time.Sleep(time.Second)
}

func compareBusyState(t *testing.T, busy1 *Busy, busy2 *Busy) bool {
	t.Helper()
	if busy1.IsBusy() != busy2.IsBusy() {
		busy1JSON, _ := busy1.ToJSON()
		busy2JSON, _ := busy2.ToJSON()
		t.Logf("busy1:%s;  busy2:%s\n", busy1JSON, busy2JSON)
		return false
	}
	if busy1.Expires().Unix() != busy2.Expires().Unix() {
		busy1JSON, _ := busy1.ToJSON()
		busy2JSON, _ := busy2.ToJSON()
		t.Logf("busy1:%s;  busy2:%s\n", busy1JSON, busy2JSON)
		return false
	}
	return true
}

// ClusterMock simulates the busy state of a cluster.
type ClusterMock struct {
	Busy *Busy
	t    *testing.T
}

func (c *ClusterMock) SendClusterMessage(msg *model.ClusterMessage) {
	var sbs model.ServerBusyState
	err := json.Unmarshal(msg.Data, &sbs)
	if err != nil {
		require.NoError(c.t, err)
	}
	c.Busy.ClusterEventChanged(&sbs)
}

func (c *ClusterMock) SendClusterMessageToNode(nodeID string, msg *model.ClusterMessage) error {
	return nil
}

func (c *ClusterMock) StartInterNodeCommunication() {}
func (c *ClusterMock) StopInterNodeCommunication()  {}
func (c *ClusterMock) RegisterClusterMessageHandler(event model.ClusterEvent, crm einterfaces.ClusterMessageHandler) {
}
func (c *ClusterMock) GetClusterId() string                           { return "cluster_mock" }
func (c *ClusterMock) IsLeader() bool                                 { return false }
func (c *ClusterMock) GetMyClusterInfo() *model.ClusterInfo           { return nil }
func (c *ClusterMock) GetClusterInfos() ([]*model.ClusterInfo, error) { return nil, nil }
func (c *ClusterMock) NotifyMsg(buf []byte)                           {}
func (c *ClusterMock) GetClusterStats(rctx request.CTX) ([]*model.ClusterStats, *model.AppError) {
	return nil, nil
}
func (c *ClusterMock) GetLogs(rctx request.CTX, page, perPage int) ([]string, *model.AppError) {
	return nil, nil
}
func (c *ClusterMock) QueryLogs(rctx request.CTX, page, perPage int) (map[string][]string, *model.AppError) {
	return nil, nil
}
func (c *ClusterMock) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) (map[string][]model.FileData, error) {
	return nil, nil
}
func (c *ClusterMock) GetPluginStatuses() (model.PluginStatuses, *model.AppError) { return nil, nil }
func (c *ClusterMock) ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError {
	return nil
}
func (c *ClusterMock) HealthScore() int { return 0 }
func (c *ClusterMock) WebConnCountForUser(userID string) (int, *model.AppError) {
	return 0, nil
}
func (c *ClusterMock) GetWSQueues(userID, connectionID string, seqNum int64) (map[string]*model.WSQueues, error) {
	return nil, nil
}
