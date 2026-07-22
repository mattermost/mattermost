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

func TestPluginAccessControlStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("SetGetIsUserAllowed", func(t *testing.T) { testPluginAccessControlSetGetIsUserAllowed(t, rctx, ss) })
	t.Run("SetUserIDsReplaces", func(t *testing.T) { testPluginAccessControlSetUserIDsReplaces(t, rctx, ss) })
	t.Run("SetUserIDsEmptyClears", func(t *testing.T) { testPluginAccessControlSetUserIDsEmptyClears(t, rctx, ss) })
	t.Run("DeleteByPlugin", func(t *testing.T) { testPluginAccessControlDeleteByPlugin(t, rctx, ss) })
	t.Run("DeleteByUser", func(t *testing.T) { testPluginAccessControlDeleteByUser(t, rctx, ss) })
}

func testPluginAccessControlSetGetIsUserAllowed(t *testing.T, rctx request.CTX, ss store.Store) {
	pluginID := "com.example.plugin-a"
	userA := model.NewId()
	userB := model.NewId()

	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginID, []string{userA, userB}))

	got, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginID)
	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.ElementsMatch(t, []string{userA, userB}, got)

	allowed, err := ss.PluginAccessControl().IsUserAllowed(rctx, pluginID, userA)
	require.NoError(t, err)
	assert.True(t, allowed)

	allowed, err = ss.PluginAccessControl().IsUserAllowed(rctx, pluginID, model.NewId())
	require.NoError(t, err)
	assert.False(t, allowed)
}

func testPluginAccessControlSetUserIDsReplaces(t *testing.T, rctx request.CTX, ss store.Store) {
	pluginID := "com.example.plugin-b"
	userA := model.NewId()
	userB := model.NewId()
	userC := model.NewId()

	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginID, []string{userA, userB}))
	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginID, []string{userC}))

	got, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginID)
	require.NoError(t, err)
	require.Equal(t, []string{userC}, got)
}

func testPluginAccessControlSetUserIDsEmptyClears(t *testing.T, rctx request.CTX, ss store.Store) {
	pluginID := "com.example.plugin-c"
	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginID, []string{model.NewId()}))
	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginID, nil))

	got, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginID)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func testPluginAccessControlDeleteByPlugin(t *testing.T, rctx request.CTX, ss store.Store) {
	pluginA := "com.example.plugin-d"
	pluginB := "com.example.plugin-e"
	userID := model.NewId()

	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginA, []string{userID}))
	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginB, []string{userID}))
	require.NoError(t, ss.PluginAccessControl().DeleteByPlugin(rctx, pluginA))

	gotA, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginA)
	require.NoError(t, err)
	assert.Empty(t, gotA)

	gotB, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginB)
	require.NoError(t, err)
	assert.Equal(t, []string{userID}, gotB)
}

func testPluginAccessControlDeleteByUser(t *testing.T, rctx request.CTX, ss store.Store) {
	pluginA := "com.example.plugin-f"
	pluginB := "com.example.plugin-g"
	userA := model.NewId()
	userB := model.NewId()

	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginA, []string{userA, userB}))
	require.NoError(t, ss.PluginAccessControl().SetUserIDs(rctx, pluginB, []string{userA}))
	require.NoError(t, ss.PluginAccessControl().DeleteByUser(rctx, userA))

	gotA, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginA)
	require.NoError(t, err)
	assert.Equal(t, []string{userB}, gotA)

	gotB, err := ss.PluginAccessControl().GetUserIDs(rctx, pluginB)
	require.NoError(t, err)
	assert.Empty(t, gotB)
}
