// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestIsLeader(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("no license returns true", func(t *testing.T) {
		th := Setup(t)
		th.Service.SetLicense(nil)

		assert.True(t, th.Service.IsLeader())
	})

	t.Run("license with cluster enabled and cluster interface returns cluster leader", func(t *testing.T) {
		fakeCluster := &testlib.FakeClusterInterface{}
		th := SetupWithCluster(t, fakeCluster)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ClusterSettings.Enable = true
		})

		// This is the only case where IsLeader returns false because it's the only case where we actually call
		// FakeClusterInterface.IsLeader() which returns false
		assert.False(t, th.Service.IsLeader())
	})

	t.Run("license without cluster feature but cluster enabled returns true", func(t *testing.T) {
		fakeCluster := &testlib.FakeClusterInterface{}
		th := SetupWithCluster(t, fakeCluster)

		// Set a license without the Cluster feature (like an Entry license)
		license := model.NewTestLicenseWithFalseDefaults("cluster")
		th.Service.SetLicense(license)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ClusterSettings.Enable = true
		})

		// Even though ClusterSettings.Enable is true and clusterIFace is set, the license doesn't support clustering,
		// so this node should be leader
		assert.True(t, th.Service.IsLeader())
	})

	t.Run("cluster settings disabled returns true", func(t *testing.T) {
		fakeCluster := &testlib.FakeClusterInterface{}
		th := SetupWithCluster(t, fakeCluster)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ClusterSettings.Enable = false
		})

		assert.True(t, th.Service.IsLeader())
	})
}

// swapOnEncode runs while Publish encodes the event, which is after it has checked for a
// cluster and before it sends to one.
type swapOnEncode func()

func (f swapOnEncode) MarshalJSON() ([]byte, error) {
	f()
	return []byte(`{}`), nil
}

// Publish must not crash if the cluster is unset after its nil check.
func TestPublishWhileClusterIsUnset(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)

	// The hubs encode every event on their own goroutines; detached, the only encode
	// is the one inside Publish.
	hubs := th.Service.hubs
	th.Service.hubs = nil
	t.Cleanup(func() { th.Service.hubs = hubs })

	cluster := &testlib.FakeClusterInterface{}
	th.Service.SetCluster(cluster)

	event := model.NewWebSocketEvent(model.WebsocketEventConfigChanged, "", "", "", nil, "")
	event.Add("config", swapOnEncode(func() { th.Service.SetCluster(nil) }))

	require.NotPanics(t, func() { th.Service.Publish(event) })
	require.Nil(t, th.Service.Cluster())
	require.Len(t, cluster.GetMessages(), 1, "the swap must land between Publish's nil check and its send")
}
