// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// pluginImplements reports whether an active plugin implements the hook, so that hot paths like
// viewing a channel only start a goroutine when a plugin will receive the hook.
func (a *App) pluginImplements(hookID int) bool {
	env := a.GetPluginsEnvironment()
	return env != nil && env.HasPluginImplementing(hookID)
}

// runChannelHasBeenViewedHooks invokes ChannelHasBeenViewed once for each channel in viewedAt,
// which maps the channels whose read position moved forward to the new read position.
func (a *App) runChannelHasBeenViewedHooks(rctx request.CTX, userID string, viewedAt map[string]int64, collapsedThreads bool) {
	if len(viewedAt) == 0 || !a.pluginImplements(plugin.ChannelHasBeenViewedID) {
		return
	}

	pluginContext := pluginContext(rctx)
	a.Srv().Go(func() {
		for channelID, channelViewedAt := range viewedAt {
			a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
				hooks.ChannelHasBeenViewed(pluginContext, userID, channelID, channelViewedAt, collapsedThreads)
				return true
			}, plugin.ChannelHasBeenViewedID)
		}
	})
}

func (a *App) runThreadHasBeenViewedHook(rctx request.CTX, userID, channelID, threadID string, viewedAt int64) {
	if !a.pluginImplements(plugin.ThreadHasBeenViewedID) {
		return
	}

	pluginContext := pluginContext(rctx)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			hooks.ThreadHasBeenViewed(pluginContext, userID, channelID, threadID, viewedAt)
			return true
		}, plugin.ThreadHasBeenViewedID)
	})
}
