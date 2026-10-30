// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
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

func TestPublishRunsPrePublishHook(t *testing.T) {
	mainHelper.Parallel(t)

	setup := func(t *testing.T) (*TestHelper, *testlib.FakeClusterInterface, *[]model.WebsocketEventType) {
		t.Helper()

		fakeCluster := &testlib.FakeClusterInterface{}
		th := SetupWithCluster(t, fakeCluster)
		var seen []model.WebsocketEventType
		th.Service.SetPrePublishHook(func(message *model.WebSocketEvent) {
			seen = append(seen, message.EventType())
			message.GetBroadcast().AddHook("pre_publish_test", map[string]any{"marker": "set"})
		})
		return th, fakeCluster, &seen
	}

	t.Run("Publish runs it before the cluster copy is serialized", func(t *testing.T) {
		th, fakeCluster, seen := setup(t)

		th.Service.Publish(model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", model.NewId(), "", nil, ""))
		require.Equal(t, []model.WebsocketEventType{model.WebsocketEventPostEdited}, *seen)

		messages := fakeCluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			return msg.Event == model.ClusterEventPublish
		})
		require.Len(t, messages, 1)
		event, err := model.WebSocketEventFromJSON(bytes.NewReader(messages[0].Data))
		require.NoError(t, err)
		require.Equal(t, []string{"pre_publish_test"}, event.GetBroadcast().BroadcastHooks)
	})

	// A receiving node delivers what the cluster sent through PublishSkipClusterSend; the
	// originating node already ran the hook on it.
	t.Run("PublishSkipClusterSend doesn't run it", func(t *testing.T) {
		th, _, seen := setup(t)

		th.Service.PublishSkipClusterSend(model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", model.NewId(), "", nil, ""))
		require.Empty(t, *seen)
	})
}
