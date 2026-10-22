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
	t.Run("SaveAndGetForChannel", func(t *testing.T) { testChannelGuardSaveAndGetForChannel(t, rctx, ss) })
	t.Run("SaveIdempotentSamePlugin", func(t *testing.T) { testChannelGuardSaveIdempotentSamePlugin(t, rctx, ss) })
	t.Run("SaveTwoPluginsSameChannel", func(t *testing.T) { testChannelGuardSaveTwoPluginsSameChannel(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testChannelGuardDelete(t, rctx, ss) })
	t.Run("DeleteRowsAffected", func(t *testing.T) { testChannelGuardDeleteRowsAffected(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testChannelGuardGetAll(t, rctx, ss) })
}

func testChannelGuardSaveAndGetForChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	pluginID := "com.example.plugin-a"

	guard := &store.ChannelGuard{
		ChannelId: channelID,
		PluginId:  pluginID,
		CreatedAt: 1000,
	}

	err := ss.ChannelGuard().Save(rctx, guard)
	require.NoError(t, err)

	got, err := ss.ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, channelID, got[0].ChannelId)
	assert.Equal(t, pluginID, got[0].PluginId)
	assert.Equal(t, int64(1000), got[0].CreatedAt)
}

func testChannelGuardSaveIdempotentSamePlugin(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	pluginID := "com.example.plugin-a"

	first := &store.ChannelGuard{ChannelId: channelID, PluginId: pluginID, CreatedAt: 1000}
	require.NoError(t, ss.ChannelGuard().Save(rctx, first))

	second := &store.ChannelGuard{ChannelId: channelID, PluginId: pluginID, CreatedAt: 2000}
	require.NoError(t, ss.ChannelGuard().Save(rctx, second))

	got, err := ss.ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, got, 1, "second save should be a no-op (DO NOTHING)")
	assert.Equal(t, int64(1000), got[0].CreatedAt, "original CreatedAt should be preserved")
}

func testChannelGuardSaveTwoPluginsSameChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	pluginA := "com.example.plugin-a"
	pluginB := "com.example.plugin-b"

	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelID, PluginId: pluginA, CreatedAt: 1000}))
	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelID, PluginId: pluginB, CreatedAt: 2000}))

	got, err := ss.ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, got, 2)

	pluginIDs := []string{got[0].PluginId, got[1].PluginId}
	assert.Contains(t, pluginIDs, pluginA)
	assert.Contains(t, pluginIDs, pluginB)
}

func testChannelGuardDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	pluginA := "com.example.plugin-a"
	pluginB := "com.example.plugin-b"

	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelID, PluginId: pluginA, CreatedAt: 1000}))
	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelID, PluginId: pluginB, CreatedAt: 2000}))

	n, err := ss.ChannelGuard().Delete(rctx, channelID, pluginA)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n, "expected 1 row deleted")

	got, err := ss.ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, got, 1, "only plugin-A's row should be deleted")
	assert.Equal(t, pluginB, got[0].PluginId)

	// Deleting an already-removed (channel, plugin) pair is a no-op, not an error.
	n, err = ss.ChannelGuard().Delete(rctx, channelID, pluginA)
	require.NoError(t, err)
	assert.Equal(t, int64(0), n, "expected 0 rows deleted for already-removed row")
}

func testChannelGuardDeleteRowsAffected(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	pluginA := "com.example.plugin-a"
	pluginB := "com.example.plugin-b"

	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelID, PluginId: pluginA, CreatedAt: 1000}))

	// Cross-plugin delete: pluginB has no claim on the channel; returns (0, nil).
	n, err := ss.ChannelGuard().Delete(rctx, channelID, pluginB)
	require.NoError(t, err)
	assert.Equal(t, int64(0), n, "cross-plugin delete must return 0 rows affected")

	// pluginA's row must be untouched.
	got, err := ss.ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, got, 1, "pluginA row must remain after cross-plugin delete")
	assert.Equal(t, pluginA, got[0].PluginId)
}

func testChannelGuardGetAll(t *testing.T, rctx request.CTX, ss store.Store) {
	channelA := model.NewId()
	channelB := model.NewId()
	pluginA := "com.example.plugin-a-" + model.NewId()
	pluginB := "com.example.plugin-b-" + model.NewId()

	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelA, PluginId: pluginA, CreatedAt: 1000}))
	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelA, PluginId: pluginB, CreatedAt: 1100}))
	require.NoError(t, ss.ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelB, PluginId: pluginA, CreatedAt: 1200}))

	all, err := ss.ChannelGuard().GetAll(rctx)
	require.NoError(t, err)

	count := 0
	for _, g := range all {
		if g.PluginId == pluginA || g.PluginId == pluginB {
			count++
		}
	}
	assert.Equal(t, 3, count, "expected 3 rows from this test fixture")
}
