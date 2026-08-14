// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Channel-guard dispatch helpers.
//
// Each runGuarded<Hook> helper implements two-phase plugin dispatch: Phase A fans out to non-guard
// plugins via RunMultiHookExcluding (fail-open, preserving RunMultiHook semantics — when guards is
// empty the exclude list is empty and the iteration is identical to plain RunMultiHook); Phase B
// calls each guard claimant in PluginId-sorted order via the *WithRPCErr companion, and fail-closed
// on transport errors. Phase B's for-range is a no-op when there are no guards, so unguarded
// channels traverse the same single linear flow with zero extra work beyond the Phase A dispatch.
//
// Allow-by-default for non-implementing claimants: a plugin may register a channel guard without
// implementing every guarded hook. When Phase B reaches such a claimant, the *WithRPCErr
// companion's g.implemented[<HookID>] gate skips the RPC call entirely and returns zero values with
// a nil error. The helper's three guard branches all skip in that case, so the claimant contributes
// nothing, basically: "this plugin had no opinion on this hook." Iteration continues to the next
// claimant.
package app

import (
	"net/http"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// resolveGuards returns the (sorted-by-PluginId) guard slice for channelID along with a
// non-nil rejectErr when the request must fail-close (plugin system disabled, or a specific
// claimant is inactive). The helper picks the right operator-facing log message internally.
// (nil, nil) means the channel is unguarded — Phase A still runs (with no exclusions) and
// Phase B's loop becomes a no-op. (guards, nil) means proceed with two-phase dispatch.
func (a *App) resolveGuards(rctx request.CTX, channelID, callerName string) (guards []*store.ChannelGuard, rejectErr *model.AppError) {
	ch := a.Channels()
	raw := ch.getGuardsForChannel(channelID)
	if len(raw) == 0 {
		return nil, nil
	}
	sorted := append([]*store.ChannelGuard(nil), raw...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].PluginId < sorted[j].PluginId })
	env := ch.GetPluginsEnvironment()
	if env == nil {
		// Plugin system disabled in config or not yet initialized, but guards exist for this
		// channel. Operator action: flip PluginSettings.Enable on, or remove the guards.
		return sorted, logAndErrPluginsDisabled(rctx, channelID, callerName)
	}
	var inactive []string
	for _, g := range sorted {
		if !env.IsActive(g.PluginId) {
			inactive = append(inactive, g.PluginId)
		}
	}
	if len(inactive) > 0 {
		return sorted, logAndErrPluginInactive(rctx, channelID, inactive, callerName)
	}
	return sorted, nil
}

// logAndErrPluginInactive emits an operator-facing Error log identifying the specific guard
// plugins that are currently inactive, then returns a generic 503 AppError. A guard plugin
// being down is an operational failure: the request must be rejected, but internal plugin IDs
// do not belong in the user-facing response. Operators read the log to diagnose which plugin
// to recover.
func logAndErrPluginInactive(rctx request.CTX, channelID string, pluginIDs []string, callerName string) *model.AppError {
	rctx.Logger().Error("Channel guard rejected operation: claiming plugin is not active",
		mlog.String("error_id", "guard_plugin_inactive"),
		mlog.String("channel_id", channelID),
		mlog.Array("plugin_ids", pluginIDs),
		mlog.String("caller", callerName),
	)
	return model.NewAppError(callerName, "app.plugin.inactive_guard.app_error", nil, "", http.StatusServiceUnavailable)
}

// logAndErrPluginsDisabled emits an operator-facing Error log when the plugin system is off
// (PluginSettings.Enable == false or not yet initialized) but guards are still cached for the
// channel. Distinct from logAndErrPluginInactive: the cause is the global plugin switch, not
// a specific plugin failure. Returns the same generic 503 to the user.
func logAndErrPluginsDisabled(rctx request.CTX, channelID, callerName string) *model.AppError {
	rctx.Logger().Error("Channel guard rejected operation: plugin system is disabled but guards exist for this channel",
		mlog.String("error_id", "plugins_disabled_with_guards"),
		mlog.String("channel_id", channelID),
		mlog.String("caller", callerName),
	)
	return model.NewAppError(callerName, "app.plugin.inactive_guard.app_error", nil, "", http.StatusServiceUnavailable)
}

func appErrHookFailed(pluginID, callerName string, err error) *model.AppError {
	appErr := model.NewAppError(callerName, "app.plugin.guard_hook_failed.app_error",
		map[string]any{"PluginID": pluginID}, "", http.StatusServiceUnavailable)
	if err != nil {
		return appErr.Wrap(err)
	}
	return appErr
}

func pluginIDsOf(guards []*store.ChannelGuard) []string {
	ids := make([]string, len(guards))
	for i, g := range guards {
		ids[i] = g.PluginId
	}
	return ids
}

// runGuardedMessageWillBePosted dispatches MessageWillBePosted. Returns the (possibly
// replaced) post, or an AppError on rejection or RPC failure.
func (a *App) runGuardedMessageWillBePosted(rctx request.CTX, post *model.Post) (*model.Post, *model.AppError) {
	guards, rejectErr := a.resolveGuards(rctx, post.ChannelId, "createPost")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	var metadata *model.PostMetadata
	if post.Metadata != nil {
		metadata = post.Metadata.Copy()
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionError *model.AppError
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, _ *model.Manifest) bool {
		replacementPost, rejectionReason := hooks.MessageWillBePosted(pCtx, post.ForPlugin())
		if rejectionReason != "" {
			id := "Post rejected by plugin. " + rejectionReason
			if rejectionReason == plugin.DismissPostError {
				id = plugin.DismissPostError
			}
			rejectionError = model.NewAppError("createPost", id, nil, "", http.StatusBadRequest)
			return false
		}
		if replacementPost != nil {
			post = replacementPost
			if post.Metadata != nil && metadata != nil {
				post.Metadata.Priority = metadata.Priority
			} else {
				post.Metadata = metadata
			}
		}
		return true
	}, plugin.MessageWillBePostedID)
	if rejectionError != nil {
		return nil, rejectionError
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, logAndErrPluginInactive(rctx, post.ChannelId, []string{g.PluginId}, "CreatePost")
		}
		replacement, reason, rpcErr := hooks.MessageWillBePostedWithRPCErr(pCtx, post.ForPlugin())
		if rpcErr != nil {
			return nil, appErrHookFailed(g.PluginId, "CreatePost", rpcErr)
		}
		if reason != "" {
			id := "Post rejected by plugin. " + reason
			if reason == plugin.DismissPostError {
				id = plugin.DismissPostError
			}
			return nil, model.NewAppError("createPost", id, nil, "", http.StatusBadRequest)
		}
		if replacement != nil {
			post = replacement
			if post.Metadata != nil && metadata != nil {
				post.Metadata.Priority = metadata.Priority
			} else {
				post.Metadata = metadata
			}
		}
	}

	return post, nil
}

// runGuardedMessageWillBeUpdated dispatches MessageWillBeUpdated. In the non-guarded
// hook variant, either newPost == nil OR rejectionReason != "" signals rejection.
func (a *App) runGuardedMessageWillBeUpdated(rctx request.CTX, newPost, oldPost *model.Post) (*model.Post, *model.AppError) {
	guards, rejectErr := a.resolveGuards(rctx, oldPost.ChannelId, "UpdatePost")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	// buildUpdateRejectionErr mirrors the legacy error shape at post.go UpdatePost.
	buildUpdateRejectionErr := func(reason string) *model.AppError {
		id := "Post rejected by plugin. " + reason
		if reason == plugin.DismissPostError {
			id = plugin.DismissPostError
		}
		return model.NewAppError("UpdatePost", id, nil, "", http.StatusBadRequest)
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionReason string
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, _ *model.Manifest) bool {
		newPost, rejectionReason = hooks.MessageWillBeUpdated(pCtx, newPost.ForPlugin(), oldPost.ForPlugin())
		return newPost != nil
	}, plugin.MessageWillBeUpdatedID)
	if newPost == nil {
		return nil, buildUpdateRejectionErr(rejectionReason)
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, logAndErrPluginInactive(rctx, oldPost.ChannelId, []string{g.PluginId}, "UpdatePost")
		}
		replacement, reason, rpcErr := hooks.MessageWillBeUpdatedWithRPCErr(pCtx, newPost.ForPlugin(), oldPost.ForPlugin())
		if rpcErr != nil {
			return nil, appErrHookFailed(g.PluginId, "UpdatePost", rpcErr)
		}
		if reason != "" {
			return nil, buildUpdateRejectionErr(reason)
		}
		// If replacement == nil && reason == "" && rpcErr == nil, the claimant had no opinion
		// (did not implement the hook). Do not treat as rejection — continue iterating.
		if replacement != nil {
			newPost = replacement
		}
	}

	return newPost, nil
}

// runGuardedChannelMemberWillBeAdded dispatches ChannelMemberWillBeAdded. Returns the (possibly
// replaced) member, or an AppError on rejection or RPC failure.
func (a *App) runGuardedChannelMemberWillBeAdded(rctx request.CTX, channelID string, member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	guards, rejectErr := a.resolveGuards(rctx, channelID, "AddUserToChannel")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	buildMemberRejectionErr := func(reason string) *model.AppError {
		return model.NewAppError("AddUserToChannel", "app.channel.add_user.to.channel.rejected_by_plugin",
			map[string]any{"Reason": reason}, "", http.StatusBadRequest)
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionError *model.AppError
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, _ *model.Manifest) bool {
		updatedMember, reason := hooks.ChannelMemberWillBeAdded(pCtx, member)
		if reason != "" {
			rejectionError = buildMemberRejectionErr(reason)
			return false
		}
		if updatedMember != nil {
			member = updatedMember
		}
		return true
	}, plugin.ChannelMemberWillBeAddedID)
	if rejectionError != nil {
		return nil, rejectionError
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, logAndErrPluginInactive(rctx, channelID, []string{g.PluginId}, "addUserToChannel")
		}
		replacement, reason, rpcErr := hooks.ChannelMemberWillBeAddedWithRPCErr(pCtx, member)
		if rpcErr != nil {
			return nil, appErrHookFailed(g.PluginId, "addUserToChannel", rpcErr)
		}
		if reason != "" {
			return nil, buildMemberRejectionErr(reason)
		}
		// If replacement == nil && reason == "" && rpcErr == nil, the claimant had no opinion
		// (did not implement the hook). Do not treat as rejection — continue iterating.
		if replacement != nil {
			member = replacement
		}
	}

	return member, nil
}

// runGuardedChannelWillBeUpdated dispatches ChannelWillBeUpdated. Guard plugins may not mutate
// Channel.Type — type changes must go through dedicated paths (e.g., UpdateChannelPrivacy). The
// check applies only to guarded channels; unguarded callers retain RunMultiHook's permissive behavior.
func (a *App) runGuardedChannelWillBeUpdated(rctx request.CTX, newChannel, oldChannel *model.Channel) (*model.Channel, *model.AppError) {
	guards, rejectErr := a.resolveGuards(rctx, newChannel.Id, "UpdateChannel")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	buildUpdateRejectionErr := func(reason string) *model.AppError {
		return model.NewAppError("UpdateChannel", "app.channel.update_channel.rejected_by_plugin",
			map[string]any{"Reason": reason}, "", http.StatusBadRequest)
	}

	buildTypeMutationErr := func(offendingPluginID string) *model.AppError {
		return model.NewAppError("UpdateChannel", "app.channel.update_channel.plugin_type_mutation.app_error",
			map[string]any{"PluginID": offendingPluginID}, "", http.StatusBadRequest)
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	// Track the last replacing plugin ID for type-mutation attribution (used only when guarded).
	var rejectionReason string
	var lastReplacingPluginID string
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		replacement, reason := hooks.ChannelWillBeUpdated(pCtx, newChannel, oldChannel)
		if reason != "" {
			rejectionReason = reason
			return false
		}
		if replacement != nil {
			newChannel = replacement
			lastReplacingPluginID = manifest.Id
		}
		return true
	}, plugin.ChannelWillBeUpdatedID)
	if rejectionReason != "" {
		return nil, buildUpdateRejectionErr(rejectionReason)
	}
	// Type-mutation check applies only to guarded channels; unguarded callers retain
	// RunMultiHook's permissive semantics.
	if len(guards) > 0 && lastReplacingPluginID != "" && newChannel.Type != oldChannel.Type {
		return nil, buildTypeMutationErr(lastReplacingPluginID)
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, logAndErrPluginInactive(rctx, newChannel.Id, []string{g.PluginId}, "UpdateChannel")
		}
		replacement, reason, rpcErr := hooks.ChannelWillBeUpdatedWithRPCErr(pCtx, newChannel, oldChannel)
		if rpcErr != nil {
			return nil, appErrHookFailed(g.PluginId, "UpdateChannel", rpcErr)
		}
		if reason != "" {
			return nil, buildUpdateRejectionErr(reason)
		}
		// If replacement == nil && reason == "" && rpcErr == nil, the claimant had no opinion
		// (did not implement the hook). Do not treat as rejection — continue iterating.
		if replacement != nil {
			newChannel = replacement
			// Check immediately after each Phase B replacement.
			if newChannel.Type != oldChannel.Type {
				return nil, buildTypeMutationErr(g.PluginId)
			}
		}
	}

	return newChannel, nil
}

// runGuardedScheduledPostWillBeCreated dispatches ScheduledPostWillBeCreated. Both SaveScheduledPost
// and UpdateScheduledPost share the same hook; the callerName and buildRejectionErr params let them
// surface distinct rejection error IDs while reusing the same two-phase body. buildRejectionErr is
// supplied by the caller so the rejection error ID stays a string literal in a NewAppError call the
// i18n extractor can see.
func (a *App) runGuardedScheduledPostWillBeCreated(
	rctx request.CTX,
	scheduledPost *model.ScheduledPost,
	callerName string,
	buildRejectionErr func(reason string) *model.AppError,
) (*model.ScheduledPost, *model.AppError) {
	// Channel the guard is resolved for; reused for the inactive-plugin log below.
	originalChannelID := scheduledPost.ChannelId

	guards, rejectErr := a.resolveGuards(rctx, originalChannelID, callerName)

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionError *model.AppError
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, _ *model.Manifest) bool {
		replacement, reason := hooks.ScheduledPostWillBeCreated(pCtx, scheduledPost)
		if reason != "" {
			rejectionError = buildRejectionErr(reason)
			return false
		}
		if replacement != nil {
			scheduledPost = replacement
		}
		return true
	}, plugin.ScheduledPostWillBeCreatedID)
	if rejectionError != nil {
		return nil, rejectionError
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, logAndErrPluginInactive(rctx, originalChannelID, []string{g.PluginId}, callerName)
		}
		replacement, reason, rpcErr := hooks.ScheduledPostWillBeCreatedWithRPCErr(pCtx, scheduledPost)
		if rpcErr != nil {
			return nil, appErrHookFailed(g.PluginId, callerName, rpcErr)
		}
		if reason != "" {
			return nil, buildRejectionErr(reason)
		}
		// If replacement == nil && reason == "" && rpcErr == nil, the claimant had no opinion
		// (did not implement the hook). Do not treat as rejection — continue iterating.
		if replacement != nil {
			scheduledPost = replacement
		}
	}

	return scheduledPost, nil
}

// runGuardedDraftWillBeUpserted dispatches DraftWillBeUpserted. Returns the (possibly
// replaced) draft, or an AppError on rejection or RPC failure.
func (a *App) runGuardedDraftWillBeUpserted(rctx request.CTX, draft *model.Draft) (*model.Draft, *model.AppError) {
	// Channel the guard is resolved for; reused for the inactive-plugin log below.
	originalChannelID := draft.ChannelId

	guards, rejectErr := a.resolveGuards(rctx, originalChannelID, "UpsertDraft")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	buildRejectionErr := func(reason string) *model.AppError {
		return model.NewAppError("UpsertDraft", "app.draft.upsert.rejected_by_plugin",
			map[string]any{"Reason": reason}, "", http.StatusBadRequest)
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionError *model.AppError
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, _ *model.Manifest) bool {
		replacement, reason := hooks.DraftWillBeUpserted(pCtx, draft)
		if reason != "" {
			rejectionError = buildRejectionErr(reason)
			return false
		}
		if replacement != nil {
			draft = replacement
		}
		return true
	}, plugin.DraftWillBeUpsertedID)
	if rejectionError != nil {
		return nil, rejectionError
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, logAndErrPluginInactive(rctx, originalChannelID, []string{g.PluginId}, "UpsertDraft")
		}
		replacement, reason, rpcErr := hooks.DraftWillBeUpsertedWithRPCErr(pCtx, draft)
		if rpcErr != nil {
			return nil, appErrHookFailed(g.PluginId, "UpsertDraft", rpcErr)
		}
		if reason != "" {
			return nil, buildRejectionErr(reason)
		}
		// If replacement == nil && reason == "" && rpcErr == nil, the claimant had no opinion
		// (did not implement the hook). Do not treat as rejection — continue iterating.
		if replacement != nil {
			draft = replacement
		}
	}

	return draft, nil
}

// runGuardedChannelWillBeRestored dispatches ChannelWillBeRestored. Reject-only — no replacement.
func (a *App) runGuardedChannelWillBeRestored(rctx request.CTX, channel *model.Channel) *model.AppError {
	guards, rejectErr := a.resolveGuards(rctx, channel.Id, "RestoreChannel")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return rejectErr
	}

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionReason string
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, _ *model.Manifest) bool {
		rejectionReason = hooks.ChannelWillBeRestored(pCtx, channel)
		return rejectionReason == ""
	}, plugin.ChannelWillBeRestoredID)
	if rejectionReason != "" {
		return model.NewAppError("RestoreChannel", "app.channel.restore_channel.rejected_by_plugin",
			map[string]any{"Reason": rejectionReason}, "", http.StatusBadRequest)
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return logAndErrPluginInactive(rctx, channel.Id, []string{g.PluginId}, "RestoreChannel")
		}
		reason, rpcErr := hooks.ChannelWillBeRestoredWithRPCErr(pCtx, channel)
		if rpcErr != nil {
			return appErrHookFailed(g.PluginId, "RestoreChannel", rpcErr)
		}
		if reason != "" {
			return model.NewAppError("RestoreChannel", "app.channel.restore_channel.rejected_by_plugin",
				map[string]any{"Reason": reason}, "", http.StatusBadRequest)
		}
	}

	return nil
}
