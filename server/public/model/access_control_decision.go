// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"slices"
)

// maxActionSearchActions bounds how many actions a single Action Search request
// may ask about, to prevent unbounded PDP evaluation loops from a single call.
const maxActionSearchActions = 16

// RenderDecisionReasonRestrictedByPolicy is the only denial reason exposed to
// clients. It is intentionally generic: it never reveals policy names,
// expressions, attribute names, or values.
const RenderDecisionReasonRestrictedByPolicy = "restricted_by_policy"

// RenderPermissionDecision is a non-authoritative, render-time ABAC decision for
// a single action. It is used by the client to decide whether to show a control;
// it MUST NOT be used to authorize an action. Enforcement always re-evaluates the
// PDP live on the server.
type RenderPermissionDecision struct {
	// Allowed reports whether the action is permitted for rendering purposes.
	Allowed bool `json:"allowed"`
	// Evaluated reports whether the server intentionally computed this decision.
	Evaluated bool `json:"evaluated"`
	// Reason is a generic, non-sensitive denial reason (e.g. "restricted_by_policy").
	// It MUST NOT contain policy names, expressions, attribute names, or values.
	Reason string `json:"reason,omitempty"`
}

// ActionSearchRequest asks "for the current session user, on this resource,
// which of these actions are allowed?". The subject is always the authenticated
// session user; there is intentionally no subject field so callers cannot probe
// other users' decisions.
type ActionSearchRequest struct {
	Resource Resource `json:"resource"`
	Actions  []string `json:"actions"`
}

// ActionSearchResponse returns a render-time decision per requested action.
type ActionSearchResponse struct {
	Resource Resource                            `json:"resource"`
	Actions  map[string]RenderPermissionDecision `json:"actions"`
}

// IsValid validates the shape of an Action Search request. It does not validate
// that the actions/resource type are supported for rendering; that allowlist
// check happens in the App layer against the renderable-action registry.
func (r *ActionSearchRequest) IsValid() *AppError {
	if r.Resource.Type == "" {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.resource_type.app_error", nil, "", http.StatusBadRequest)
	}
	if !IsValidId(r.Resource.ID) {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.resource_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(r.Actions) == 0 {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.actions_empty.app_error", nil, "", http.StatusBadRequest)
	}
	if len(r.Actions) > maxActionSearchActions {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.actions_too_many.app_error", map[string]any{"Max": maxActionSearchActions}, "", http.StatusBadRequest)
	}
	if slices.Contains(r.Actions, "") {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.action_empty.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}
