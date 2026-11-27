// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// renderableActionConfig controls fallback behavior when ABAC is inactive or evaluation fails.
type renderableActionConfig struct {
	ResourceType        string
	DefaultWhenInactive bool
	// FailClosedOnError records that a subject-build or PDP error answers denied+evaluated
	// rather than DefaultWhenInactive. Every action is answered by its enforcement function,
	// which denies on errors, so every action must set it.
	FailClosedOnError bool
}

// renderableABACActions is the allowlist of ABAC actions that may be queried
// through the render-decision (Action Search) API. Any action not present here
// is rejected with 400 to prevent arbitrary action probing and to centralize the
// security posture for each renderable affordance.
var renderableABACActions = map[string]renderableActionConfig{
	model.AccessControlPolicyActionUploadFileAttachment: {
		ResourceType:        model.AccessControlPolicyTypeChannel,
		DefaultWhenInactive: true,
		FailClosedOnError:   true,
	},
	model.AccessControlPolicyActionDownloadFileAttachment: {
		ResourceType:        model.AccessControlPolicyTypeChannel,
		DefaultWhenInactive: true,
		FailClosedOnError:   true,
	},
	// Answered by its enforcement gate, which already allows while ABAC is inactive and
	// fails closed on errors, so DefaultWhenInactive and FailClosedOnError only record that.
	model.AccessControlPolicyActionChannelReadAccess: {
		ResourceType:        model.AccessControlPolicyTypeChannel,
		DefaultWhenInactive: true,
		FailClosedOnError:   true,
	},
	model.AccessControlPolicyActionChannelWriteAccess: {
		ResourceType:        model.AccessControlPolicyTypeChannel,
		DefaultWhenInactive: true,
		FailClosedOnError:   true,
	},
	model.AccessControlPolicyActionChannelManagementAccess: {
		ResourceType:        model.AccessControlPolicyTypeChannel,
		DefaultWhenInactive: true,
		FailClosedOnError:   true,
	},
	model.AccessControlPolicyActionCreateBurnOnReadPost: {
		ResourceType:        model.AccessControlPolicyTypeChannel,
		DefaultWhenInactive: true,
		FailClosedOnError:   true,
	},
}

// SearchAllowedActionsForCurrentUser computes non-authoritative, render-time ABAC
// decisions for the current session user on a single resource. Each action is
// answered by its enforcement function (HasChannelReadAccessByID,
// channelWriteAccessDecisionByID, channelManagementAccessDecisionByID,
// HasPermissionToChannelAction), so a render "allowed" can never disagree with what
// enforcement would decide, and both share the decision cache's entries. Results
// MUST NOT be used to authorize an action; the protected endpoints always check
// again, from the decision cache or the PDP.
//
// When req.Actions is nil/empty the function operates in discovery mode: it
// evaluates all renderable actions registered for the resource type and returns
// the permitted set. When req.Actions is non-empty only those specific actions
// are evaluated (targeted mode).
func (a *App) SearchAllowedActionsForCurrentUser(rctx request.CTX, req model.ActionSearchRequest) (*model.ActionSearchResponse, *model.AppError) {
	if appErr := req.IsValid(); appErr != nil {
		return nil, appErr
	}

	// Subject reservation: any Subject whose ID != session user is rejected.
	// This gate exists to make Phase 3 (arbitrary-subject evaluation, Enterprise)
	// a non-breaking extension — the field is in the contract but gated here.
	if req.Subject != nil && req.Subject.ID != rctx.Session().UserId {
		return nil, model.NewAppError(
			"SearchAllowedActionsForCurrentUser",
			"app.access_control_decision.subject_mismatch.app_error",
			nil, "", http.StatusForbidden)
	}

	// Discovery mode: collect registry entries for the resource type, then sort for
	// deterministic wire output — Go map iteration is non-deterministic.
	// Targeted mode: validate each requested action against the registry.
	var candidates []string
	if len(req.Actions) == 0 {
		for action, cfg := range renderableABACActions {
			if cfg.ResourceType == req.Resource.Type {
				candidates = append(candidates, action)
			}
		}
		slices.Sort(candidates)
	} else {
		for _, action := range req.Actions {
			cfg, ok := renderableABACActions[action]
			if !ok || cfg.ResourceType != req.Resource.Type {
				return nil, model.NewAppError("SearchAllowedActionsForCurrentUser", "app.access_control_decision.unsupported_action.app_error", map[string]any{"Action": action}, "", http.StatusBadRequest)
			}
		}
		candidates = req.Actions
	}

	resp := &model.ActionSearchResponse{
		Resource:  req.Resource,
		Results:   []model.ActionSearchResult{},                                     // always non-nil so it serializes as []
		Decisions: make(map[string]model.RenderPermissionDecision, len(candidates)), // always non-nil so it serializes as {}
	}
	record := func(action string, d model.RenderPermissionDecision) {
		resp.Decisions[action] = d
		if d.Allowed {
			resp.Results = append(resp.Results, model.ActionSearchResult{Action: model.ActionSearchResultAction{Name: action}})
		}
	}

	acs := a.Srv().Channels().AccessControl
	active := acs != nil && a.attributeBasedAccessControlEnabled()

	channelID := ""
	if req.Resource.Type == model.AccessControlPolicyTypeChannel {
		channelID = req.Resource.ID
	}

	exempt := active && slices.ContainsFunc(candidates, isChannelAccessAction) && a.channelAccessExemptByID(rctx, req.Resource.ID)
	managementExempt := active && slices.Contains(candidates, model.AccessControlPolicyActionChannelManagementAccess) &&
		a.SessionHasPermissionTo(*rctx.Session(), model.PermissionManageSystem)
	recordIfExempt := func(action string) bool {
		if !(exempt && isChannelAccessAction(action)) &&
			!(managementExempt && action == model.AccessControlPolicyActionChannelManagementAccess) {
			return false
		}
		record(action, model.RenderPermissionDecision{Allowed: true, Evaluated: true})
		return true
	}

	// Every action is answered by its enforcement function, so render and enforcement read
	// and fill the same decision-cache entries with the same subject. The memo builds the
	// session's subject once for the whole request.
	rctx = WithChannelAccessMemo(rctx)
	userID := rctx.Session().UserId
	for _, action := range candidates {
		if action == model.AccessControlPolicyActionChannelReadAccess {
			// Its enforcement gate also exempts DMs and GMs, requires Enterprise Advanced,
			// and allows without evaluating when no policy governs the action, so a bare
			// PDP call would disagree with enforcement on each of those.
			record(action, model.RenderPermissionDecision{
				Allowed:   a.HasChannelReadAccessByID(rctx, userID, req.Resource.ID),
				Evaluated: true,
			})
			continue
		}

		// No active policy, or a channel permission action while its enforcement is off (the
		// flag, ABAC or an Enterprise Advanced license is missing, so enforcement allows
		// everything) — the per-action default.
		if !active || (model.IsChannelPermissionAction(action) && !a.ChannelAccessEnforcementActive()) {
			record(action, model.RenderPermissionDecision{
				Allowed:   renderableABACActions[action].DefaultWhenInactive,
				Evaluated: true,
			})
			continue
		}

		if recordIfExempt(action) {
			continue
		}

		// An enforcement function denies on a subject-build or PDP error, which is what
		// FailClosedOnError asks for; every renderable action sets it.
		var allowed bool
		switch action {
		case model.AccessControlPolicyActionChannelWriteAccess:
			allowed = a.channelWriteAccessDecisionByID(rctx, userID, channelID)
		case model.AccessControlPolicyActionChannelManagementAccess:
			allowed = a.channelManagementAccessDecisionByID(rctx, userID, channelID)
		default:
			allowed = a.HasPermissionToChannelAction(rctx, userID, rctx.Session().Roles, channelID, action)
		}
		record(action, model.RenderPermissionDecision{
			Allowed:   allowed,
			Evaluated: true,
		})
	}

	return resp, nil
}

func (a *App) channelAccessExemptByID(rctx request.CTX, channelID string) bool {
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return false
	}
	return channelAccessExempt(channel)
}
