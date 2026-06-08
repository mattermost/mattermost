// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// renderableActionConfig describes how a single ABAC action may be exposed to
// the client for render-time decisions, and how to behave when ABAC is inactive
// or the evaluation fails.
type renderableActionConfig struct {
	// ResourceType is the resource type this action is evaluated against.
	ResourceType string
	// DefaultWhenInactive is the Allowed value returned when ABAC is not active
	// for this server/resource (so the client uses a single rendering path).
	DefaultWhenInactive bool
	// FailClosedOnError, when true, returns a denied+evaluated decision on
	// subject-build or PDP errors (appropriate for security-sensitive actions).
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
func (a *App) SearchAllowedActionsForCurrentUser(rctx request.CTX, req model.ActionSearchRequest) (*model.ActionSearchResponse, *model.AppError) {
	if appErr := req.IsValid(); appErr != nil {
		return nil, appErr
	}

	// Reject any action not in the renderable allowlist (prevents arbitrary
	// action probing and enforces the per-action resource type).
	for _, action := range req.Actions {
		cfg, ok := renderableABACActions[action]
		if !ok || cfg.ResourceType != req.Resource.Type {
			return nil, model.NewAppError("SearchAllowedActionsForCurrentUser", "app.access_control_decision.unsupported_action.app_error", map[string]any{"Action": action}, "", http.StatusBadRequest)
		}
	}

	resp := &model.ActionSearchResponse{
		Resource: req.Resource,
		Actions:  make(map[string]model.RenderPermissionDecision, len(req.Actions)),
	}

	// When ABAC is not active there is no policy restricting these actions; return
	// the per-action default so the client can use a single rendering path.
	acs := a.Srv().Channels().AccessControl
	abacInactive := acs == nil ||
		!*a.Config().AccessControlSettings.EnableAttributeBasedAccessControl ||
		!a.Config().FeatureFlags.PermissionPolicies
	if abacInactive {
		for _, action := range req.Actions {
			resp.Actions[action] = model.RenderPermissionDecision{
				Allowed:   renderableABACActions[action].DefaultWhenInactive,
				Evaluated: true,
			}
		}
		return resp, nil
	}

	// Build the subject ONCE, then evaluate every requested action against it.
	subject, appErr := a.BuildAccessControlSubjectForSession(rctx, req.Resource.ID)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for render-decision search",
			mlog.String("resource_type", req.Resource.Type),
			mlog.String("resource_id", req.Resource.ID),
			mlog.Err(appErr),
		)
		for _, action := range req.Actions {
			resp.Actions[action] = renderDecisionOnError(action)
		}
		return resp, nil
	}

	for _, action := range req.Actions {
		decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
			Subject: *subject,
			Resource: model.Resource{
				Type: req.Resource.Type,
				ID:   req.Resource.ID,
			},
			Action: action,
		})
		if evalErr != nil {
			rctx.Logger().Debug("ABAC render-decision evaluation failed",
				mlog.String("action", action),
				mlog.String("resource_id", req.Resource.ID),
				mlog.Err(evalErr),
			)
			resp.Actions[action] = renderDecisionOnError(action)
			continue
		}
		resp.Actions[action] = model.RenderPermissionDecision{
			Allowed:   decision.Decision,
			Evaluated: true,
		}
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
