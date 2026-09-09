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
// a single action. MUST NOT be used to authorize — enforcement always re-evaluates
// the PDP live on the server.
type RenderPermissionDecision struct {
	Allowed   bool   `json:"allowed"`
	Evaluated bool   `json:"evaluated"`
	Reason    string `json:"reason,omitempty"`
}

// ActionSearchResultAction is the action identity inside an AuthZEN result entry.
type ActionSearchResultAction struct {
	Name string `json:"name"`
}

// ActionSearchResult is the AuthZEN-canonical permitted-action entry.
// Only PERMITTED actions appear in the results list; denial is expressed by omission.
type ActionSearchResult struct {
	Action ActionSearchResultAction `json:"action"`
}

// ActionSearchSubject is RESERVED for Phase 3 cross-subject evaluation.
// In Phase 2, any Subject.ID that does not match the authenticated session user is
// rejected with 403. The field is present in the contract to make Phase 3 a
// non-breaking extension of this endpoint.
type ActionSearchSubject struct {
	ID   string `json:"id"`
	Type string `json:"type,omitempty"`
}

// ActionSearchPage is RESERVED for Phase 3 pagination.
// Accepted in requests but always ignored; next_token is never emitted in responses.
type ActionSearchPage struct {
	NextToken string `json:"next_token,omitempty"`
}

// ActionSearchRequest asks "for the current session user, on this resource,
// which actions are allowed?".
//
// Actions is optional:
//   - nil or empty → discovery mode: the server evaluates all renderable actions
//     registered for the resource type and returns the permitted set.
//   - non-empty → targeted mode: the server evaluates exactly those actions
//     (max 16; all must be registered for the resource type).
//
// Subject is RESERVED. If provided, its ID must equal the authenticated session
// user ID; mismatches are rejected with 403.
//
// Page is RESERVED. Accepted but always ignored.
type ActionSearchRequest struct {
	Resource Resource             `json:"resource"`
	Actions  []string             `json:"actions,omitempty"` // optional; nil/empty = discovery
	Subject  *ActionSearchSubject `json:"subject,omitempty"` // reserved
	Page     *ActionSearchPage    `json:"page,omitempty"`    // reserved
}

// ActionSearchResponse returns render-time ABAC decisions for the requested resource.
//
// Results is the AuthZEN-canonical list: only actions the server evaluated as
// PERMITTED appear here. An empty Results ([]) is meaningful — all evaluated actions
// were denied — and is always present (never null).
//
// Decisions is the Mattermost extension: all evaluated actions appear here with full
// decision detail (Allowed, Evaluated, Reason), including denied ones. Always present.
//
// Page is RESERVED; always absent in the current implementation.
type ActionSearchResponse struct {
	Resource  Resource                            `json:"resource"`
	Results   []ActionSearchResult                `json:"results"`   // no omitempty — [] is meaningful
	Decisions map[string]RenderPermissionDecision `json:"decisions"` // no omitempty — {} is meaningful
	Page      *ActionSearchPage                   `json:"page,omitempty"`
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
	// nil/empty Actions = discovery mode (valid). Validate bounds only when non-empty.
	if len(r.Actions) > maxActionSearchActions {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.actions_too_many.app_error", map[string]any{"Max": maxActionSearchActions}, "", http.StatusBadRequest)
	}
	if slices.Contains(r.Actions, "") {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.action_empty.app_error", nil, "", http.StatusBadRequest)
	}
	// Subject shape validation. Identity check (must match session user) is in the app layer.
	if r.Subject != nil && !IsValidId(r.Subject.ID) {
		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.subject_id.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}
