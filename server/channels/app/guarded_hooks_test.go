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

// guardPluginRejectsAll generates a plugin that implements ScheduledPostWillBeCreated and
// DraftWillBeUpserted to reject every call with rejectReason. It does NOT call
// RegisterChannelGuard in OnActivate; the test registers the guard via th.App.RegisterChannelGuard
// after activation (matching the TestChannelGuardBlocksPostWhenPluginInactive pattern).
func guardPluginRejectsAll(rejectReason string) string {
	return `
	package main

	import (
		"github.com/mattermost/mattermost/server/public/plugin"
		"github.com/mattermost/mattermost/server/public/model"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) ScheduledPostWillBeCreated(c *plugin.Context, sp *model.ScheduledPost) (*model.ScheduledPost, string) {
		return nil, "` + rejectReason + `"
	}

	func (p *MyPlugin) DraftWillBeUpserted(c *plugin.Context, draft *model.Draft) (*model.Draft, string) {
		return nil, "` + rejectReason + `"
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	`
}

// guardPluginRegistersOnly generates a plugin that only registers a channel guard on OnActivate.
// Used for the inactive-guard tests: the guard row persists after the plugin is deactivated,
// allowing the test to verify the fail-closed rejection.
func guardPluginRegistersOnly(channelID string) string {
	return `
	package main

	import (
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) OnActivate() error {
		return p.API.RegisterChannelGuard("` + channelID + `")
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	`
}

// enableDrafts turns on AllowSyncedDrafts and returns a cleanup that restores the read-only
// feature-flag state. Drafts are gated behind that flag, so the draft guard tests must enable it.
func enableDrafts(th *TestHelper) func() {
	th.Server.platform.SetConfigReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })
	return func() { th.Server.platform.SetConfigReadOnlyFF(true) }
}

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

// TestChannelGuardBlocksScheduledPostWhenPluginInactive verifies fail-closed enforcement on the
// SaveScheduledPost / UpdateScheduledPost paths. Three states are exercised per caller:
// (1) plugin active + hook rejects → 400 rejected_by_plugin, no row persisted
// (2) plugin inactive after guard registration → 503 inactive_guard, no row persisted
// (3) unguarded channel → passes through, row persists normally
func TestChannelGuardBlocksScheduledPostWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)

	// State 1: plugin active and hook rejects — SaveScheduledPost.
	// The plugin does NOT call RegisterChannelGuard in OnActivate; the test registers the guard
	// directly so the plugin process stays alive and can serve the hook RPC call.
	t.Run("save rejected by active plugin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t,
			[]string{guardPluginRejectsAll("not permitted")},
			th.App, th.NewPluginAPI,
		)
		defer tearDown()
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
		require.Nil(t, appErr, "RegisterChannelGuard must succeed")

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "should be rejected",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		_, appErr = th.App.SaveScheduledPost(th.Context, sp, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		// A rejection must not persist any row — same bar as the inactive-guard state.
		rows, storeErr := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicTeam.Id)
		require.NoError(t, storeErr)
		for _, row := range rows {
			assert.NotEqual(t, th.BasicChannel.Id, row.ChannelId, "rejected scheduled post must not be in the store")
		}
	})

	// State 2: plugin inactive — SaveScheduledPost must return 503 and write no row.
	// This plugin registers the guard in OnActivate; the guard row persists after deactivation.
	t.Run("save blocked when guard plugin inactive", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t,
			[]string{guardPluginRegistersOnly(th.BasicChannel.Id)},
			th.App, th.NewPluginAPI,
		)
		defer tearDown()
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "plaintext must not persist",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		_, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)

		// No row may exist for this channel/user.
		rows, storeErr := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicTeam.Id)
		require.NoError(t, storeErr)
		for _, row := range rows {
			assert.NotEqual(t, th.BasicChannel.Id, row.ChannelId, "rejected scheduled post must not be in the store")
		}
	})

	// State 3: unguarded channel — SaveScheduledPost passes through, row persists
	t.Run("save passes on unguarded channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// No plugin loaded → no guard row → plain pass-through.
		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "unguarded, should persist",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		saved, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)

		// Confirm the row actually exists in the store with the expected content.
		fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(saved.Id)
		require.NoError(t, storeErr)
		assert.Equal(t, "unguarded, should persist", fetched.Message)
	})

	// State 1 (update): plugin active and hook rejects — UpdateScheduledPost.
	// Guard registered via App method so the plugin process stays alive.
	t.Run("update rejected by active plugin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Save first (no plugin yet).
		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "original",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		saved, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t,
			[]string{guardPluginRejectsAll("update not permitted")},
			th.App, th.NewPluginAPI,
		)
		defer tearDown()
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		appErr = th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
		require.Nil(t, appErr, "RegisterChannelGuard must succeed")

		saved.Message = "edited"
		_, appErr = th.App.UpdateScheduledPost(th.Context, th.BasicUser.Id, saved, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		// The store row must still have the original message — the rejection must not mutate it.
		fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(saved.Id)
		require.NoError(t, storeErr)
		assert.Equal(t, "original", fetched.Message, "rejected update must not be persisted")
	})

	// State 2 (update): plugin inactive — UpdateScheduledPost must return 503 and not persist.
	// Guard registered in OnActivate; the row persists after deactivation.
	t.Run("update blocked when guard plugin inactive", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// Save the post before activating the guard plugin.
		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "original",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		saved, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t,
			[]string{guardPluginRegistersOnly(th.BasicChannel.Id)},
			th.App, th.NewPluginAPI,
		)
		defer tearDown()
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		saved.Message = "should be rejected"
		_, appErr = th.App.UpdateScheduledPost(th.Context, th.BasicUser.Id, saved, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)

		// The store row must still have the original message.
		fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(saved.Id)
		require.NoError(t, storeErr)
		assert.Equal(t, "original", fetched.Message, "rejected update must not be persisted")
	})

	// State 3 (update): unguarded channel — UpdateScheduledPost passes through
	t.Run("update passes on unguarded channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "original",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		saved, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)

		saved.Message = "updated"
		updated, appErr := th.App.UpdateScheduledPost(th.Context, th.BasicUser.Id, saved, "")
		require.Nil(t, appErr)
		require.NotNil(t, updated)
		assert.Equal(t, "updated", updated.Message)

		// Confirm the updated message is actually in the store.
		fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(saved.Id)
		require.NoError(t, storeErr)
		assert.Equal(t, "updated", fetched.Message)
	})
}

// TestChannelGuardBlocksDraftWhenPluginInactive verifies fail-closed enforcement on the
// UpsertDraft path. Three states are exercised:
// (1) plugin active + hook rejects → 400 rejected_by_plugin, no row persisted
// (2) plugin inactive after guard registration → 503 inactive_guard, no row persisted
// (3) unguarded channel → passes through, row persists normally
func TestChannelGuardBlocksDraftWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)

	// State 1: plugin active and hook rejects.
	// Guard registered via App method so the plugin process stays alive for the hook call.
	t.Run("rejected by active plugin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)
		defer enableDrafts(th)()

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t,
			[]string{guardPluginRejectsAll("draft not permitted")},
			th.App, th.NewPluginAPI,
		)
		defer tearDown()
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
		require.Nil(t, appErr, "RegisterChannelGuard must succeed")

		draft := &model.Draft{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "should be rejected",
		}
		_, appErr = th.App.UpsertDraft(th.Context, draft, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		drafts, getErr := th.App.GetDraftsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, getErr)
		assert.Empty(t, drafts)
	})

	// State 2: plugin inactive — UpsertDraft must return 503 and write no row.
	// Guard registered in OnActivate; the row persists after deactivation.
	t.Run("blocked when guard plugin inactive", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)
		defer enableDrafts(th)()

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t,
			[]string{guardPluginRegistersOnly(th.BasicChannel.Id)},
			th.App, th.NewPluginAPI,
		)
		defer tearDown()
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		draft := &model.Draft{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "plaintext must not persist",
		}
		_, appErr := th.App.UpsertDraft(th.Context, draft, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)

		// No draft row may exist for this channel/user.
		drafts, getErr := th.App.GetDraftsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, getErr)
		for _, d := range drafts {
			assert.NotEqual(t, th.BasicChannel.Id, d.ChannelId, "rejected draft must not be in the store")
		}
	})

	// State 3: unguarded channel — UpsertDraft passes through, row persists
	t.Run("passes on unguarded channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)
		defer enableDrafts(th)()

		// No plugin loaded → no guard row → plain pass-through.
		draft := &model.Draft{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "unguarded, should persist",
		}
		saved, appErr := th.App.UpsertDraft(th.Context, draft, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)

		// Confirm the row actually exists in the store with the expected content.
		drafts, getErr := th.App.GetDraftsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, getErr)
		require.NotEmpty(t, drafts)
		var found bool
		for _, d := range drafts {
			if d.ChannelId == th.BasicChannel.Id {
				assert.Equal(t, "unguarded, should persist", d.Message)
				found = true
			}
		}
		assert.True(t, found, "draft must exist in the store for the expected channel")
	})
}
