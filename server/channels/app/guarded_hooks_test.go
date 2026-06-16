// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// seedGuardCache directly populates the Channels guard cache for unit tests that
// need guards without going through the full DB round-trip.
func seedGuardCache(th *TestHelper, channelID string, guards []*store.ChannelGuard) {
	m := &sync.Map{}
	if len(guards) > 0 {
		m.Store(channelID, guards)
	}
	th.App.Channels().guardCache.Store(m)
}

func TestResolveGuards(t *testing.T) {
	t.Run("no guards returns nil nil", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Empty cache — channel has no guard rows.
		seedGuardCache(th, th.BasicChannel.Id, nil)

		rctx := request.EmptyContext(th.App.Srv().Log())
		guards, rejectErr := th.App.resolveGuards(rctx, th.BasicChannel.Id, "test")
		require.Nil(t, rejectErr)
		require.Nil(t, guards)
	})

	t.Run("cache uninitialized returns nil nil", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Store a nil *sync.Map — models the brief window before the first reload.
		th.App.Channels().guardCache.Store((*sync.Map)(nil))

		rctx := request.EmptyContext(th.App.Srv().Log())
		guards, rejectErr := th.App.resolveGuards(rctx, th.BasicChannel.Id, "test")
		require.Nil(t, rejectErr)
		require.Nil(t, guards)
	})

	t.Run("guards are sorted by PluginId", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Insert guards in reverse alphabetical order; resolveGuards must return them sorted.
		unsorted := []*store.ChannelGuard{
			{ChannelId: th.BasicChannel.Id, PluginId: "zzz.plugin"},
			{ChannelId: th.BasicChannel.Id, PluginId: "aaa.plugin"},
			{ChannelId: th.BasicChannel.Id, PluginId: "mmm.plugin"},
		}
		seedGuardCache(th, th.BasicChannel.Id, unsorted)

		// All plugin IDs are unknown to the environment → IsActive returns false for each.
		// Disable plugins so resolveGuards hits the env==nil branch instead.
		// We only want to test sort order, so use a trick: temporarily disable plugins to
		// get through the env==nil fast-path and confirm the sorted slice is built before
		// the env check. Actually env==nil returns early with the sorted slice — that's
		// correct behaviour to assert sort order.
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })

		rctx := request.EmptyContext(th.App.Srv().Log())
		guards, rejectErr := th.App.resolveGuards(rctx, th.BasicChannel.Id, "test")
		// env==nil → reject is non-nil, but guards slice must still be sorted.
		require.NotNil(t, rejectErr, "plugins disabled + guards exist → expect reject error")
		require.Len(t, guards, 3)
		assert.Equal(t, "aaa.plugin", guards[0].PluginId)
		assert.Equal(t, "mmm.plugin", guards[1].PluginId)
		assert.Equal(t, "zzz.plugin", guards[2].PluginId)
	})

	t.Run("single inactive plugin returns reject error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Seed one guard with a plugin ID that is not active in the environment.
		fakePlugin := "com.example.inactive-single"
		seedGuardCache(th, th.BasicChannel.Id, []*store.ChannelGuard{
			{ChannelId: th.BasicChannel.Id, PluginId: fakePlugin},
		})

		rctx := request.EmptyContext(th.App.Srv().Log())
		guards, rejectErr := th.App.resolveGuards(rctx, th.BasicChannel.Id, "callerA")
		require.NotNil(t, rejectErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", rejectErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, rejectErr.StatusCode)
		// Guards slice is returned even on reject so callers can log the full context.
		require.Len(t, guards, 1)
		assert.Equal(t, fakePlugin, guards[0].PluginId)
	})

	t.Run("multiple inactive plugins returns reject error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Two inactive guards — exercises the mlog.Array path in logAndErrPluginInactive.
		seedGuardCache(th, th.BasicChannel.Id, []*store.ChannelGuard{
			{ChannelId: th.BasicChannel.Id, PluginId: "com.example.inactive-a"},
			{ChannelId: th.BasicChannel.Id, PluginId: "com.example.inactive-b"},
		})

		rctx := request.EmptyContext(th.App.Srv().Log())
		guards, rejectErr := th.App.resolveGuards(rctx, th.BasicChannel.Id, "callerB")
		require.NotNil(t, rejectErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", rejectErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, rejectErr.StatusCode)
		require.Len(t, guards, 2)
	})

	t.Run("env nil branch returns reject error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		fakePlugin := "com.example.env-nil"
		seedGuardCache(th, th.BasicChannel.Id, []*store.ChannelGuard{
			{ChannelId: th.BasicChannel.Id, PluginId: fakePlugin},
		})

		// Disable the plugin system so GetPluginsEnvironment returns nil.
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })

		rctx := request.EmptyContext(th.App.Srv().Log())
		guards, rejectErr := th.App.resolveGuards(rctx, th.BasicChannel.Id, "callerC")
		require.NotNil(t, rejectErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", rejectErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, rejectErr.StatusCode)
		// Guards slice is still populated with the sorted rows.
		require.Len(t, guards, 1)
	})
}

func TestPluginIDsOf(t *testing.T) {
	t.Run("nil input returns empty slice", func(t *testing.T) {
		ids := pluginIDsOf(nil)
		assert.Empty(t, ids)
	})

	t.Run("empty input returns empty slice", func(t *testing.T) {
		ids := pluginIDsOf([]*store.ChannelGuard{})
		assert.Empty(t, ids)
	})

	t.Run("multiple guards returns IDs in input order", func(t *testing.T) {
		guards := []*store.ChannelGuard{
			{PluginId: "aaa"},
			{PluginId: "bbb"},
			{PluginId: "ccc"},
		}
		ids := pluginIDsOf(guards)
		require.Equal(t, []string{"aaa", "bbb", "ccc"}, ids)
	})
}

func TestAppErrHookFailed(t *testing.T) {
	t.Run("without error sets correct fields", func(t *testing.T) {
		appErr := appErrHookFailed("com.example.plugin", "CreatePost", nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
		// err==nil branch: no Wrap, so Unwrap returns nil.
		assert.NoError(t, appErr.Unwrap())
	})

	t.Run("with error wraps it", func(t *testing.T) {
		cause := errors.New("rpc transport failure")
		appErr := appErrHookFailed("com.example.plugin", "UpdatePost", cause)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
		// err!=nil branch: Wrap stores it; errors.Is traverses via Unwrap.
		assert.ErrorIs(t, appErr, cause)
	})
}

func TestLogAndErrPluginInactive(t *testing.T) {
	t.Run("single plugin ID returns correct AppError", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)
		rctx := request.EmptyContext(th.App.Srv().Log())

		appErr := logAndErrPluginInactive(rctx, "ch-id-1", []string{"com.example.only"}, "callerX")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
	})

	t.Run("multiple plugin IDs returns correct AppError", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)
		rctx := request.EmptyContext(th.App.Srv().Log())

		appErr := logAndErrPluginInactive(rctx, "ch-id-2", []string{"com.a", "com.b", "com.c"}, "callerY")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
	})
}

func TestLogAndErrPluginsDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	rctx := request.EmptyContext(th.App.Srv().Log())

	appErr := logAndErrPluginsDisabled(rctx, "ch-id-3", "callerZ")
	require.NotNil(t, appErr)
	// Same user-visible error ID as inactive_guard (internal cause differs).
	assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
	assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
}
