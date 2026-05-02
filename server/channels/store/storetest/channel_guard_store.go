// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelGuardStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("SaveAndGetForChannel", func(t *testing.T) { testChannelGuardSaveAndGetForChannel(t, ss) })
	t.Run("SaveIdempotentSamePlugin", func(t *testing.T) { testChannelGuardSaveIdempotentSamePlugin(t, ss) })
	t.Run("SaveTwoPluginsSameChannel", func(t *testing.T) { testChannelGuardSaveTwoPluginsSameChannel(t, ss) })
	t.Run("Delete", func(t *testing.T) { testChannelGuardDelete(t, ss) })
	t.Run("GetAll", func(t *testing.T) { testChannelGuardGetAll(t, ss) })
}

func testChannelGuardSaveAndGetForChannel(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	pluginID := "com.example.plugin-a"

	guard := &store.ChannelGuard{
		ChannelId: channelID,
		PluginId:  pluginID,
		CreatedAt: 1000,
	}

	err := ss.ChannelGuard().Save(guard)
	require.NoError(t, err)

	got, err := ss.ChannelGuard().GetForChannel(channelID)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, channelID, got[0].ChannelId)
	assert.Equal(t, pluginID, got[0].PluginId)
	assert.Equal(t, int64(1000), got[0].CreatedAt)
}

func testChannelGuardSaveIdempotentSamePlugin(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	pluginID := "com.example.plugin-a"

	first := &store.ChannelGuard{ChannelId: channelID, PluginId: pluginID, CreatedAt: 1000}
	require.NoError(t, ss.ChannelGuard().Save(first))

	second := &store.ChannelGuard{ChannelId: channelID, PluginId: pluginID, CreatedAt: 2000}
	require.NoError(t, ss.ChannelGuard().Save(second))

	got, err := ss.ChannelGuard().GetForChannel(channelID)
	require.NoError(t, err)
	require.Len(t, got, 1, "second save should be a no-op (DO NOTHING)")
	assert.Equal(t, int64(1000), got[0].CreatedAt, "original CreatedAt should be preserved")
}

func testChannelGuardSaveTwoPluginsSameChannel(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	pluginA := "com.example.plugin-a"
	pluginB := "com.example.plugin-b"

	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelID, PluginId: pluginA, CreatedAt: 1000}))
	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelID, PluginId: pluginB, CreatedAt: 2000}))

	got, err := ss.ChannelGuard().GetForChannel(channelID)
	require.NoError(t, err)
	require.Len(t, got, 2)

	pluginIDs := []string{got[0].PluginId, got[1].PluginId}
	assert.Contains(t, pluginIDs, pluginA)
	assert.Contains(t, pluginIDs, pluginB)
}

func testChannelGuardDelete(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	pluginA := "com.example.plugin-a"
	pluginB := "com.example.plugin-b"

	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelID, PluginId: pluginA, CreatedAt: 1000}))
	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelID, PluginId: pluginB, CreatedAt: 2000}))

	require.NoError(t, ss.ChannelGuard().Delete(channelID, pluginA))

	got, err := ss.ChannelGuard().GetForChannel(channelID)
	require.NoError(t, err)
	require.Len(t, got, 1, "only plugin-A's row should be deleted")
	assert.Equal(t, pluginB, got[0].PluginId)

	// Deleting an already-removed (channel, plugin) pair is a no-op, not an error.
	require.NoError(t, ss.ChannelGuard().Delete(channelID, pluginA))
}

func testChannelGuardGetAll(t *testing.T, ss store.Store) {
	channelA := model.NewId()
	channelB := model.NewId()
	pluginA := "com.example.plugin-a-" + model.NewId()
	pluginB := "com.example.plugin-b-" + model.NewId()

	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelA, PluginId: pluginA, CreatedAt: 1000}))
	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelA, PluginId: pluginB, CreatedAt: 1100}))
	require.NoError(t, ss.ChannelGuard().Save(&store.ChannelGuard{ChannelId: channelB, PluginId: pluginA, CreatedAt: 1200}))

	all, err := ss.ChannelGuard().GetAll()
	require.NoError(t, err)

	count := 0
	for _, g := range all {
		if g.PluginId == pluginA || g.PluginId == pluginB {
			count++
		}
	}
	assert.Equal(t, 3, count, "expected 3 rows from this test fixture")
}
