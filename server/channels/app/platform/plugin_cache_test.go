// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestPluginCache(t *testing.T) {
	th := Setup(t)

	t.Run("set, get and delete", func(t *testing.T) {
		require.NoError(t, th.Service.PluginCacheSet("plugin-a", "k", []byte("v"), 0))

		got, err := th.Service.PluginCacheGet("plugin-a", "k")
		require.NoError(t, err)
		assert.Equal(t, []byte("v"), got)

		require.NoError(t, th.Service.PluginCacheDelete("plugin-a", "k"))
		got, err = th.Service.PluginCacheGet("plugin-a", "k")
		require.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("keys are namespaced per plugin", func(t *testing.T) {
		require.NoError(t, th.Service.PluginCacheSet("plugin-a", "shared", []byte("a"), 0))
		require.NoError(t, th.Service.PluginCacheSet("plugin-b", "shared", []byte("b"), 0))

		a, err := th.Service.PluginCacheGet("plugin-a", "shared")
		require.NoError(t, err)
		b, err := th.Service.PluginCacheGet("plugin-b", "shared")
		require.NoError(t, err)
		assert.Equal(t, []byte("a"), a)
		assert.Equal(t, []byte("b"), b)
	})

	t.Run("entries expire", func(t *testing.T) {
		require.NoError(t, th.Service.PluginCacheSet("plugin-a", "ttl", []byte("v"), 50*time.Millisecond))
		require.Eventually(t, func() bool {
			got, err := th.Service.PluginCacheGet("plugin-a", "ttl")
			return err == nil && got == nil
		}, 2*time.Second, 20*time.Millisecond)
	})

	t.Run("rejects invalid input", func(t *testing.T) {
		assert.Error(t, th.Service.PluginCacheSet("plugin-a", "", []byte("v"), 0))
		assert.Error(t, th.Service.PluginCacheSet("plugin-a", strings.Repeat("k", PluginCacheMaxKeyLength+1), []byte("v"), 0))
		assert.Error(t, th.Service.PluginCacheSet("plugin-a", "big", make([]byte, PluginCacheMaxValueSize+1), 0))
	})
}

func TestPluginCacheCluster(t *testing.T) {
	cluster := &mocks.ClusterInterface{}
	cluster.On("RegisterClusterMessageHandler", mock.Anything, mock.Anything).Maybe().Return()
	cluster.On("Shutdown").Maybe().Return(nil)
	var sent []*model.ClusterMessage
	cluster.On("SendClusterMessage", mock.Anything).Maybe().Run(func(args mock.Arguments) {
		sent = append(sent, args.Get(0).(*model.ClusterMessage))
	}).Return()
	th := SetupWithCluster(t, cluster)

	sent = nil
	require.NoError(t, th.Service.PluginCacheSet("plugin-a", "k", []byte("v"), 0))
	var setMsg *model.ClusterMessage
	for _, m := range sent {
		if m.Event == model.ClusterEventPluginCache {
			setMsg = m
		}
	}
	require.NotNil(t, setMsg)

	require.NoError(t, th.Service.PluginCacheDelete("plugin-a", "k"))
	got, err := th.Service.PluginCacheGet("plugin-a", "k")
	require.NoError(t, err)
	require.Nil(t, got)

	th.Service.clusterPluginCacheHandler(setMsg)
	got, err = th.Service.PluginCacheGet("plugin-a", "k")
	require.NoError(t, err)
	assert.Equal(t, []byte("v"), got)

	data, err := json.Marshal(&pluginCacheMessage{Op: pluginCacheOpDelete, Key: "plugin-a:k"})
	require.NoError(t, err)
	th.Service.clusterPluginCacheHandler(&model.ClusterMessage{Event: model.ClusterEventPluginCache, Data: data})
	got, err = th.Service.PluginCacheGet("plugin-a", "k")
	require.NoError(t, err)
	assert.Nil(t, got)
}
