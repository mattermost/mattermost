// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Reasons attached to policy-driven membership audit records, describing why the
// access control system added or removed the user.
const (
	AccessControlAuditReasonMatchesPolicy   = "matches-policy"
	AccessControlAuditReasonNoLongerMatches = "no-longer-matches"
	AccessControlAuditReasonTeamCascade     = "team-removal-cascade"
)

// Abstract resource types for membership audit records. A single policy decision
// targets a channel today and may target teams or other resources as membership
// sync expands, so records carry the type explicitly rather than a hardcoded
// channel_id/team_id.
const (
	AccessControlAuditResourceChannel = "channel"
	AccessControlAuditResourceTeam    = "team"
)

// Membership actions recorded on policy-driven audit records.
const (
	AccessControlAuditActionAdd    = "add"
	AccessControlAuditActionRemove = "remove"
)

// AccessControlMembershipAuditData is the payload for a single policy-driven
// membership change: one user, one resource, one action. It maps directly to the
// fields emitted on the audit record.
type AccessControlMembershipAuditData struct {
	JobID          string
	PolicyID       string
	PolicyRevision int
	ResourceType   string
	ResourceID     string
	UserID         string
	Action         string
	Reason         string
	// EventID/ParentEventID correlate a removal with the cascade records it
	// triggers (e.g. a team removal and the channel removals that follow).
	EventID       string
	ParentEventID string
}

// accessControlAuditLoggingEnabled reports whether ABAC policy-decision audit
// logging is enabled. Records are still only persisted when an audit target is
// active; this only reflects the operator opt-in.
func (a *App) accessControlAuditLoggingEnabled() bool {
	setting := a.Config().AccessControlSettings.EnableAccessControlAuditLogging
	return setting != nil && *setting
}

// accessControlPolicyRevision returns the revision of the access control policy
// identified by policyID (for channel/team policies the policy ID is the
// resource ID). Auditing is best-effort, so lookup failures resolve to 0 rather
// than blocking the membership change.
func (a *App) accessControlPolicyRevision(rctx request.CTX, policyID string) int {
	policy, err := a.Srv().Store().AccessControlPolicy().Get(rctx, policyID)
	if err != nil || policy == nil {
		return 0
	}
	return policy.Revision
}

// buildAccessControlMembershipAuditRecord assembles the audit record for a
// policy-driven membership change, or returns nil when ABAC audit logging is
// disabled. Kept separate from LogAccessControlMembershipAudit so the gating and
// field mapping are testable without an audit target.
func (a *App) buildAccessControlMembershipAuditRecord(rctx request.CTX, event, status string, data AccessControlMembershipAuditData) *model.AuditRecord {
	if !a.accessControlAuditLoggingEnabled() {
		return nil
	}

	rec := a.MakeAuditRecord(rctx, event, status)
	if data.JobID != "" {
		model.AddEventParameterToAuditRec(rec, "job_id", data.JobID)
	}
	model.AddEventParameterToAuditRec(rec, "policy_id", data.PolicyID)
	model.AddEventParameterToAuditRec(rec, "policy_revision", data.PolicyRevision)
	model.AddEventParameterToAuditRec(rec, "resource_type", data.ResourceType)
	model.AddEventParameterToAuditRec(rec, "resource_id", data.ResourceID)
	model.AddEventParameterToAuditRec(rec, "user_id", data.UserID)
	model.AddEventParameterToAuditRec(rec, "action", data.Action)
	if data.Reason != "" {
		model.AddEventParameterToAuditRec(rec, "reason", data.Reason)
	}
	if data.EventID != "" {
		model.AddEventParameterToAuditRec(rec, "event_id", data.EventID)
	}
	if data.ParentEventID != "" {
		model.AddEventParameterToAuditRec(rec, "parent_event_id", data.ParentEventID)
	}
	return rec
}

// LogAccessControlMembershipAudit emits a per-user audit record for a single
// policy-driven membership change, gated behind
// AccessControlSettings.EnableAccessControlAuditLogging. The audit target adds
// the record timestamp.
func (a *App) LogAccessControlMembershipAudit(rctx request.CTX, event, status string, data AccessControlMembershipAuditData) {
	rec := a.buildAccessControlMembershipAuditRecord(rctx, event, status, data)
	if rec == nil {
		return
	}
	a.LogAuditRec(rctx, rec, nil)
}
