// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// renderableActionConfig controls fallback behavior when ABAC is inactive or evaluation fails.
type renderableActionConfig struct {
	ResourceType        string
	DefaultWhenInactive bool
	// FailClosedOnError returns denied+evaluated on subject-build or PDP errors
	// rather than falling back to DefaultWhenInactive. Set for security-sensitive actions.
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
}

// SearchAllowedActionsForCurrentUser computes non-authoritative, render-time ABAC
// decisions for the current session user on a single resource. It mirrors the
// enforcement path (BuildAccessControlSubjectForSession + AccessEvaluation with
// the same Resource shape) so a render "allowed" can never disagree with what
// enforcement would decide. Results MUST NOT be used to authorize an action; the
// protected endpoints always re-evaluate the PDP live.
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

	// No active policy — return per-action defaults.
	acs := a.Srv().Channels().AccessControl
	abacInactive := acs == nil ||
		a.Config().AccessControlSettings.EnableAttributeBasedAccessControl == nil ||
		!*a.Config().AccessControlSettings.EnableAttributeBasedAccessControl ||
		!a.Config().FeatureFlags.PermissionPolicies
	if abacInactive {
		for _, action := range candidates {
			record(action, model.RenderPermissionDecision{
				Allowed:   renderableABACActions[action].DefaultWhenInactive,
				Evaluated: true,
			})
		}
		return resp, nil
	}

	// All currently registered resource types are channel-scoped, so req.Resource.ID
	// is always a channel ID here. If a non-channel resource type is ever added to
	// renderableABACActions, this call must be updated to pass the correct channel ID.
	subject, appErr := a.BuildAccessControlSubjectForSession(rctx, req.Resource.ID)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for render-decision search",
			mlog.String("resource_type", req.Resource.Type),
			mlog.String("resource_id", req.Resource.ID),
			mlog.Err(appErr),
		)
		for _, action := range candidates {
			record(action, renderDecisionOnError(action))
		}
		return resp, nil
	}

	for _, action := range candidates {
		decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
			Subject:  *subject,
			Resource: req.Resource,
			Action:   action,
		})
		if evalErr != nil {
			rctx.Logger().Debug("ABAC render-decision evaluation failed",
				mlog.String("action", action),
				mlog.String("resource_id", req.Resource.ID),
				mlog.Err(evalErr),
			)
			record(action, renderDecisionOnError(action))
			continue
		}
		record(action, model.RenderPermissionDecision{
			Allowed:   decision.Decision,
			Evaluated: true,
		})
	}

	return resp, nil
}

// renderDecisionOnError returns the conservative decision for an action whose
// subject build or PDP evaluation failed: fail closed (deny + generic reason)
// for security-sensitive actions, otherwise fall back to the inactive default.
func renderDecisionOnError(action string) model.RenderPermissionDecision {
	cfg := renderableABACActions[action]
	if cfg.FailClosedOnError {
		return model.RenderPermissionDecision{
			Allowed:   false,
			Evaluated: true,
			Reason:    model.RenderDecisionReasonRestrictedByPolicy,
		}
	}
	return model.RenderPermissionDecision{
		Allowed:   cfg.DefaultWhenInactive,
		Evaluated: true,
	}
}
