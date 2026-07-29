// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Policy-driven membership operations.
//
// These `*MemberByAccessPolicy` methods are the single entry points the ABAC
// membership sync uses to add or remove a user from a channel or team. Each one
// performs the membership mutation and then records the per-user decision (gated
// behind EnableAccessControlAuditLogging), so the enterprise sync job only
// decides *who* changes and never emits audit records itself. Keeping all four
// here gives channels and teams a symmetric surface and keeps every access
// control membership audit trigger in the app layer.
//
// Teams differ from channels in two ways: they DM the affected user, and a team
// removal cascades to the team's channels. That cascade (and the team removal
// record that correlates it) can only be emitted from inside LeaveTeam, so
// RemoveTeamMemberByAccessPolicy is the single method here that delegates its
// audit rather than emitting it inline. Every other add/remove records the
// decision inline, right next to the mutation.

// AddChannelMemberByAccessPolicy adds a user to a channel because they satisfy
// its access policy, then records the decision.
func (a *App) AddChannelMemberByAccessPolicy(rctx request.CTX, channel *model.Channel, userID, jobID string, policyRevision int) *model.AppError {
	if _, appErr := a.AddChannelMember(rctx, userID, channel, ChannelMemberOpts{}); appErr != nil {
		return appErr
	}

	// For channel policies the policy ID is the channel (resource) ID.
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventChannelMembershipAdded, model.AuditStatusSuccess, AccessControlMembershipAuditData{
		JobID:          jobID,
		PolicyID:       channel.Id,
		PolicyRevision: policyRevision,
		ResourceType:   AccessControlAuditResourceChannel,
		ResourceID:     channel.Id,
		UserID:         userID,
		Action:         AccessControlAuditActionAdd,
		Reason:         AccessControlAuditReasonMatchesPolicy,
	})
	return nil
}

// RemoveChannelMemberByAccessPolicy removes a user from a channel because they no
// longer satisfy its access policy, then records the decision.
func (a *App) RemoveChannelMemberByAccessPolicy(rctx request.CTX, channel *model.Channel, userID, jobID string, policyRevision int) *model.AppError {
	if appErr := a.RemoveUserFromChannel(rctx, userID, "", channel); appErr != nil {
		return appErr
	}

	a.LogAccessControlMembershipAudit(rctx, model.AuditEventChannelMembershipRemoved, model.AuditStatusSuccess, AccessControlMembershipAuditData{
		JobID:          jobID,
		PolicyID:       channel.Id,
		PolicyRevision: policyRevision,
		ResourceType:   AccessControlAuditResourceChannel,
		ResourceID:     channel.Id,
		UserID:         userID,
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonNoLongerMatches,
	})
	return nil
}

// AddTeamMemberByAccessPolicy adds a user to a team because they satisfy its
// access policy, then records the decision. The "you were added" DM is
// best-effort and must not undo the add. systemBot may be pre-resolved by the
// caller (nil resolves it lazily).
func (a *App) AddTeamMemberByAccessPolicy(rctx request.CTX, team *model.Team, systemBot *model.Bot, userID string) *model.AppError {
	if _, _, appErr := a.AddUserToTeam(rctx, team.Id, userID, ""); appErr != nil {
		return appErr
	}

	// For team policies the policy ID is the team (resource) ID. Only look up the
	// revision when auditing is on, to avoid a store call on every add otherwise.
	policyRevision := 0
	if a.accessControlAuditLoggingEnabled() {
		policyRevision = a.accessControlPolicyRevision(rctx, team.Id)
	}
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventTeamMembershipAdded, model.AuditStatusSuccess, AccessControlMembershipAuditData{
		PolicyID:       team.Id,
		PolicyRevision: policyRevision,
		ResourceType:   AccessControlAuditResourceTeam,
		ResourceID:     team.Id,
		UserID:         userID,
		Action:         AccessControlAuditActionAdd,
		Reason:         AccessControlAuditReasonMatchesPolicy,
	})

	if appErr := a.SendTeamAccessControlAdditionNotification(rctx, systemBot, userID, team); appErr != nil {
		rctx.Logger().Warn("Failed to send team addition notification", mlog.String("team_id", team.Id), mlog.String("user_id", userID), mlog.Err(appErr))
	}
	return nil
}

// RemoveTeamMemberByAccessPolicy removes a user from a team because they no
// longer satisfy its access policy. Removal cascades through LeaveTeam, which
// drops the user from the team's channels and emits the gated policy-removal and
// per-channel cascade audit records via logAccessControlTeamRemoval /
// logAccessControlTeamCascadedChannelRemoval (defined below). LeaveTeam owns
// those triggers because only it enumerates the cascaded channels. The "you were
// removed" DM is best-effort. systemBot may be pre-resolved by the caller (nil
// resolves it lazily).
func (a *App) RemoveTeamMemberByAccessPolicy(rctx request.CTX, team *model.Team, systemBot *model.Bot, userID string) *model.AppError {
	if appErr := a.RemoveUserFromTeam(rctx, team.Id, userID, ""); appErr != nil {
		return appErr
	}

	if appErr := a.SendTeamAccessControlRemovalNotification(rctx, systemBot, userID, team); appErr != nil {
		rctx.Logger().Warn("Failed to send team removal notification", mlog.String("team_id", team.Id), mlog.String("user_id", userID), mlog.Err(appErr))
	}
	return nil
}

// logAccessControlTeamRemoval records a policy-driven team membership removal.
// eventID is the shared correlation ID that the cascaded channel-removal records
// reference as their parent. It is called from LeaveTeam, which owns the trigger
// because only it enumerates the cascaded channels; the field/event mapping lives
// here so all ABAC membership audit shapes stay in one place. Gated behind
// EnableAccessControlAuditLogging.
func (a *App) logAccessControlTeamRemoval(rctx request.CTX, teamID, userID, eventID string, policyRevision int, status string) {
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventTeamMembershipRemoved, status, AccessControlMembershipAuditData{
		PolicyID:       teamID,
		PolicyRevision: policyRevision,
		ResourceType:   AccessControlAuditResourceTeam,
		ResourceID:     teamID,
		UserID:         userID,
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonNoLongerMatches,
		EventID:        eventID,
	})
}

// logAccessControlTeamCascadedChannelRemoval records that a policy-driven team
// removal cascaded the user out of one of the team's channels. parentEventID
// correlates it with the team-removal record from logAccessControlTeamRemoval.
// The policy is still the team's, so PolicyID is the team ID while the resource
// is the channel. Gated behind EnableAccessControlAuditLogging.
func (a *App) logAccessControlTeamCascadedChannelRemoval(rctx request.CTX, teamID, channelID, userID, parentEventID string, policyRevision int) {
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventTeamCascadedChannelRemoval, model.AuditStatusSuccess, AccessControlMembershipAuditData{
		PolicyID:       teamID,
		PolicyRevision: policyRevision,
		ResourceType:   AccessControlAuditResourceChannel,
		ResourceID:     channelID,
		UserID:         userID,
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonTeamCascade,
		ParentEventID:  parentEventID,
	})
}
