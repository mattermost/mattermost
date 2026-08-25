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
//
// Each add/remove keys its audit off the membership actually changing rather
// than off a nil error. The underlying Add*/Remove* helpers keep working after
// the membership row is written (join and leave posts, sidebar categories, cache
// invalidation), so a late failure there still leaves access changed. Since the
// next sync sees the user in their final state and would never retry them, a
// dropped record would be lost for good.
//
// On error each method therefore re-reads the membership and records the change
// if the user ended up in the state the sync was driving them towards. Errors
// raised before the mutation leave the user on the near side of that check, so
// they still record nothing. This reads the end state rather than proving which
// call produced it, which is sound because the sync only asks to remove users it
// just enumerated as members and to add users it just found missing.

// AddChannelMemberByAccessPolicy adds a user to a channel because they satisfy
// its access policy, then records the decision.
func (a *App) AddChannelMemberByAccessPolicy(rctx request.CTX, channel *model.Channel, userID, jobID string, policyRevision int) *model.AppError {
	_, appErr := a.AddChannelMember(rctx, userID, channel, ChannelMemberOpts{})
	if appErr != nil && !a.channelMembershipExists(rctx, channel.Id, userID) {
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
	return appErr
}

// RemoveChannelMemberByAccessPolicy removes a user from a channel because they no
// longer satisfy its access policy, then records the decision.
func (a *App) RemoveChannelMemberByAccessPolicy(rctx request.CTX, channel *model.Channel, userID, jobID string, policyRevision int) *model.AppError {
	appErr := a.RemoveUserFromChannel(rctx, userID, "", channel)
	if appErr != nil && a.channelMembershipExists(rctx, channel.Id, userID) {
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
	return appErr
}

// AddTeamMemberByAccessPolicy adds a user to a team because they satisfy its
// access policy, then records the decision. The "you were added" DM is
// best-effort and must not undo the add. systemBot may be pre-resolved by the
// caller (nil resolves it lazily).
func (a *App) AddTeamMemberByAccessPolicy(rctx request.CTX, team *model.Team, systemBot *model.Bot, userID, jobID string, policyRevision int) *model.AppError {
	_, _, appErr := a.AddUserToTeam(rctx, team.Id, userID, "")
	if appErr != nil && !a.teamMembershipExists(rctx, team.Id, userID) {
		return appErr
	}

	// For team policies the policy ID is the team (resource) ID.
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventTeamMembershipAdded, model.AuditStatusSuccess, AccessControlMembershipAuditData{
		JobID:          jobID,
		PolicyID:       team.Id,
		PolicyRevision: policyRevision,
		ResourceType:   AccessControlAuditResourceTeam,
		ResourceID:     team.Id,
		UserID:         userID,
		Action:         AccessControlAuditActionAdd,
		Reason:         AccessControlAuditReasonMatchesPolicy,
	})

	if dmErr := a.SendTeamAccessControlAdditionNotification(rctx, systemBot, userID, team); dmErr != nil {
		rctx.Logger().Warn("Failed to send team addition notification", mlog.String("team_id", team.Id), mlog.String("user_id", userID), mlog.Err(dmErr))
	}
	return appErr
}

// RemoveTeamMemberByAccessPolicy removes a user from a team because they no
// longer satisfy its access policy. Removal cascades through LeaveTeam, which
// drops the user from the team's channels and emits the gated policy-removal and
// per-channel cascade audit records via logAccessControlTeamRemoval /
// logAccessControlTeamCascadedChannelRemoval (defined below). LeaveTeam owns
// those triggers because only it enumerates the cascaded channels. The "you were
// removed" DM is best-effort. systemBot may be pre-resolved by the caller (nil
// resolves it lazily).
func (a *App) RemoveTeamMemberByAccessPolicy(rctx request.CTX, team *model.Team, systemBot *model.Bot, userID, jobID string, policyRevision int) *model.AppError {
	syncCtx := &accessControlSyncContext{jobID: jobID, policyRevision: policyRevision}
	if appErr := a.removeUserFromTeam(rctx, team.Id, userID, "", syncCtx); appErr != nil {
		return appErr
	}

	if appErr := a.SendTeamAccessControlRemovalNotification(rctx, systemBot, userID, team); appErr != nil {
		rctx.Logger().Warn("Failed to send team removal notification", mlog.String("team_id", team.Id), mlog.String("user_id", userID), mlog.Err(appErr))
	}
	return nil
}

// accessControlSyncContext carries the membership sync's per-resource audit
// context through the generic team removal path, which cannot take extra audit
// arguments on its exported signature. A nil pointer means the removal did not
// come from the sync, so there is no job to attribute it to and the policy
// revision is resolved on demand instead of being supplied up front.
type accessControlSyncContext struct {
	jobID          string
	policyRevision int
}

// channelMembershipExists reports whether the user currently holds a membership
// row for the channel.
func (a *App) channelMembershipExists(rctx request.CTX, channelID, userID string) bool {
	_, err := a.Srv().Store().Channel().GetMember(rctx, channelID, userID)
	return err == nil
}

// teamMembershipExists reports whether the user currently holds an active
// membership row for the team.
func (a *App) teamMembershipExists(rctx request.CTX, teamID, userID string) bool {
	member, err := a.GetTeamMember(rctx, teamID, userID)
	return err == nil && member != nil && member.DeleteAt == 0
}

// accessControlTeamRemovalAudit is the correlation state shared by every record a
// single policy-driven team removal emits: the team-removal record and one
// cascade record per channel the user loses. leaveTeam builds it once and owns
// the triggers, because only it enumerates those channels; the field/event
// mapping lives here so all ABAC membership audit shapes stay in one place.
type accessControlTeamRemovalAudit struct {
	teamID string
	userID string
	jobID  string
	// eventID is the team-removal record's own ID and the parent ID carried by
	// each cascade record, which is what ties the two together.
	eventID        string
	policyRevision int
}

// removalData is the payload for the team-removal record itself.
func (d accessControlTeamRemovalAudit) removalData() AccessControlMembershipAuditData {
	return AccessControlMembershipAuditData{
		JobID:          d.jobID,
		PolicyID:       d.teamID,
		PolicyRevision: d.policyRevision,
		ResourceType:   AccessControlAuditResourceTeam,
		ResourceID:     d.teamID,
		UserID:         d.userID,
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonNoLongerMatches,
		EventID:        d.eventID,
	}
}

// cascadeData is the payload for one channel the team removal cascaded into. The
// policy is still the team's, so PolicyID stays the team ID while the resource is
// the channel.
func (d accessControlTeamRemovalAudit) cascadeData(channelID string) AccessControlMembershipAuditData {
	return AccessControlMembershipAuditData{
		JobID:          d.jobID,
		PolicyID:       d.teamID,
		PolicyRevision: d.policyRevision,
		ResourceType:   AccessControlAuditResourceChannel,
		ResourceID:     channelID,
		UserID:         d.userID,
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonTeamCascade,
		ParentEventID:  d.eventID,
	}
}

// logAccessControlTeamRemoval records a policy-driven team membership removal.
// Gated behind EnableAccessControlAuditLogging.
func (a *App) logAccessControlTeamRemoval(rctx request.CTX, data accessControlTeamRemovalAudit, status string) {
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventTeamMembershipRemoved, status, data.removalData())
}

// logAccessControlTeamCascadedChannelRemoval records that a policy-driven team
// removal cascaded the user out of one of the team's channels. Gated behind
// EnableAccessControlAuditLogging.
func (a *App) logAccessControlTeamCascadedChannelRemoval(rctx request.CTX, data accessControlTeamRemovalAudit, channelID string) {
	a.LogAccessControlMembershipAudit(rctx, model.AuditEventTeamCascadedChannelRemoval, model.AuditStatusSuccess, data.cascadeData(channelID))
}
