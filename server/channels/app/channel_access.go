// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// channelAccessMemoKey is the request.CTX value key for the per-request
// access_channel memo.
type channelAccessMemoKey struct{}

// channelAccessMemo memoises access_channel decisions for the lifetime of one
// request. It does two jobs at once.
//
// It collapses repeated evaluation. The channel gates nest — a post read goes
// through the post gate, the read-channel gate and the channel gate — and list
// surfaces call them once per post or per channel, so a single request can ask
// the same question dozens of times. Without the memo one getPost would cost
// four PDP round trips and a websocket fan-out would cost one per recipient per
// mention.
//
// It also carries the error contract: a false entry means "the policy denied
// this channel", which is what lets the API return a distinct error id instead
// of the generic permission error. RBAC is evaluated first and && short-circuits,
// so a channel denied on RBAC alone is never recorded here.
//
// The built subject is deliberately not memoised. BuildAccessControlSubject
// attaches the channel-scoped role, so a subject is only valid for the one
// channel it was built for.
type channelAccessMemo struct {
	mu        sync.Mutex
	decisions map[string]bool
}

func (m *channelAccessMemo) get(channelID string) (allowed bool, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	allowed, ok = m.decisions[channelID]
	return allowed, ok
}

func (m *channelAccessMemo) set(channelID string, allowed bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.decisions[channelID] = allowed
}

func getChannelAccessMemo(rctx request.CTX) *channelAccessMemo {
	if v := rctx.Context().Value(channelAccessMemoKey{}); v != nil {
		if memo, ok := v.(*channelAccessMemo); ok {
			return memo
		}
	}
	return nil
}

// WithChannelAccessMemo installs the per-request access_channel memo.
//
// The web layer calls this once while assembling the request context, before the
// handler runs. It cannot be installed further down: request.CTX values are
// carried on a context that is cloned by every With* call, so a memo installed
// inside a callee is discarded when it returns and the error contract would never
// see the denial. Calling it more than once is safe — only the outermost
// installation allocates.
//
// Contexts built outside a request (background jobs, websocket fan-out, wsapi)
// have no memo, and every reader here tolerates its absence.
func WithChannelAccessMemo(rctx request.CTX) request.CTX {
	if getChannelAccessMemo(rctx) != nil {
		return rctx
	}
	memo := &channelAccessMemo{decisions: map[string]bool{}}
	return rctx.WithContext(context.WithValue(rctx.Context(), channelAccessMemoKey{}, memo))
}

// ChannelAccessDeniedByPolicy reports whether this request denied the given
// channel on the access_channel policy rather than on RBAC. The API layer uses it
// to choose the error id, so a client can tell "you cannot view this channel
// right now" apart from "you were removed from this channel". False whenever the
// policy was never consulted.
func ChannelAccessDeniedByPolicy(rctx request.CTX, channelID string) bool {
	memo := getChannelAccessMemo(rctx)
	if memo == nil {
		return false
	}
	allowed, ok := memo.get(channelID)
	return ok && !allowed
}

// accessChannelEnforcementActive reports whether access_channel is being enforced
// on this server at all: the feature flag and its PermissionPolicies umbrella, the
// ABAC config switch, the licence, and a registered access control service.
//
// Callers that cannot resolve a channel use this to decide whether a permissive
// fallback is safe. It deliberately says nothing about whether a policy exists —
// that question needs a channel.
func (a *App) accessChannelEnforcementActive() bool {
	return a.Config().FeatureFlags.IsAccessChannelABACPermissionEnabled() &&
		a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		a.Srv().Channels().AccessControl != nil
}

// HasPermissionToAccessChannel evaluates the ABAC access_channel action for a user
// on a channel. Unlike membership, which decides who may belong to a channel, this
// is re-decided on every request so a rule can reference the session's device,
// network or user agent.
//
// It is ANDed into every channel permission gate rather than checked per surface,
// because access_channel is a prerequisite for any interaction with a channel —
// gating only read-shaped permissions would leave the write paths reachable for a
// session that cannot see the channel.
//
// Deliberately not exempted: system admins and local-mode sessions are evaluated
// like anyone else, matching HasPermissionToFileAction. Exempt call sites use the
// RBACOnly siblings instead, so every exemption is visible where it is taken.
//
// Returns true when the feature is inert (flag off, ABAC disabled, unlicensed, no
// service) or when no policy governs the channel, and false on any subject-build
// or evaluation failure.
func (a *App) HasPermissionToAccessChannel(rctx request.CTX, userID string, channel *model.Channel) bool {
	// A nil channel reaches here from the policy-administration surfaces, which
	// pass a policy ID where a channel ID is expected: a team or parent policy ID
	// is not a channel, so there is nothing to govern.
	if channel == nil || userID == "" {
		return true
	}

	// DMs and GMs cannot carry a channel-scoped policy, and a system-scoped one
	// would silently take a user's private conversations away.
	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return true
	}

	if !a.accessChannelEnforcementActive() {
		return true
	}

	memo := getChannelAccessMemo(rctx)
	if memo != nil {
		if allowed, ok := memo.get(channel.Id); ok {
			return allowed
		}
	}

	allowed := a.evaluateAccessChannel(rctx, userID, channel)
	if memo != nil {
		memo.set(channel.Id, allowed)
	}
	return allowed
}

// evaluateAccessChannel is the uncached decision: the governance short-circuit,
// then a live PDP evaluation.
func (a *App) evaluateAccessChannel(rctx request.CTX, userID string, channel *model.Channel) bool {
	acs := a.Srv().Channels().AccessControl

	// Nothing to decide when no policy declares the action. A system-scoped
	// permission policy applies to every channel, so both it and the channel's own
	// policy have to be absent. ActionHasPermissionPolicy reports governed on any
	// error, so a failure costs an evaluation rather than an allow.
	governed, appErr := acs.ActionHasPermissionPolicy(rctx, model.AccessControlPolicyActionAccessChannel)
	if appErr != nil {
		rctx.Logger().Debug("Failed to check whether permission policies govern access_channel; evaluating anyway",
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
	}
	if !governed && !channel.PolicyEnforced {
		return true
	}

	subject, appErr := a.buildAccessChannelSubject(rctx, userID, channel.Id)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for access_channel evaluation; denying",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		return false
	}

	decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
		Subject: *subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypeChannel,
			ID:   channel.Id,
		},
		Action: model.AccessControlPolicyActionAccessChannel,
	})
	if evalErr != nil {
		rctx.Logger().Warn("ABAC access_channel evaluation failed; denying",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(evalErr),
		)
		return false
	}

	return decision.Decision
}

// buildAccessChannelSubject assembles the subject for the user being evaluated.
//
// Session attributes come only from the requesting session, so they are available
// for a self-check and absent otherwise. That is intentional: a caller asking about
// a third party (a webhook, a notification decision, per-recipient fan-out) has no
// session for that user, and a rule referencing user.session.* then denies rather
// than evaluating against whatever the caller's own device happens to be.
func (a *App) buildAccessChannelSubject(rctx request.CTX, userID, channelID string) (*model.Subject, *model.AppError) {
	if rctx.Session().UserId == userID {
		return a.BuildAccessControlSubjectForSession(rctx, channelID)
	}

	// GetUser is the cached read BuildAccessControlSubject performs anyway, so
	// resolving roles here costs a cache hit rather than a query.
	user, appErr := a.GetUser(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}
	return a.BuildAccessControlSubject(rctx, userID, user.Roles, channelID)
}

// hasPermissionToAccessChannelByID resolves the channel before evaluating, for the
// gates that only carry an ID.
//
// A channel that does not exist is allowed: the policy-administration endpoints
// pass policy IDs through the channel gates, and a team or parent policy has no
// channel behind it. Any other lookup failure denies, because a channel that may
// be governed must not be waved through on an infrastructure error.
func (a *App) hasPermissionToAccessChannelByID(rctx request.CTX, userID, channelID string) bool {
	if channelID == "" || !a.accessChannelEnforcementActive() {
		return true
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return true
		}
		rctx.Logger().Warn("Failed to resolve channel for access_channel evaluation; denying",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return false
	}

	return a.HasPermissionToAccessChannel(rctx, userID, channel)
}
