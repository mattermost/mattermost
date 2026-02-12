// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// StatusTransitionReason describes why a status transition is occurring
type StatusTransitionReason string

const (
	TransitionReasonManual        StatusTransitionReason = "manual"         // User explicitly set status
	TransitionReasonConnect       StatusTransitionReason = "connect"        // WebSocket connected
	TransitionReasonDisconnect    StatusTransitionReason = "disconnect"     // WebSocket disconnected
	TransitionReasonInactivity    StatusTransitionReason = "inactivity"     // Inactivity timeout
	TransitionReasonActivity      StatusTransitionReason = "activity"       // User showed activity
	TransitionReasonDNDExpired    StatusTransitionReason = "dnd_expired"    // Timed DND expired
	TransitionReasonDNDInactivity StatusTransitionReason = "dnd_inactivity" // DND user went inactive
	TransitionReasonChannelView   StatusTransitionReason = "channel_view"   // User viewed a channel
	TransitionReasonHeartbeat     StatusTransitionReason = "heartbeat"      // Heartbeat with activity
)

// StatusTransitionOptions configures a status transition request
type StatusTransitionOptions struct {
	UserID       string
	NewStatus    string                 // Target status (Online, Away, Offline, DND, OOO)
	Reason       StatusTransitionReason // Why the transition is happening
	Manual       bool                   // Is this an explicit user action?
	Force        bool                   // Force transition even if manual status is set
	Device       string                 // Device initiating the transition
	ChannelID    string                 // Active channel (if applicable)
	WindowActive bool                   // Is the user's window active?
	DNDEndTime   int64                  // For timed DND (seconds, not milliseconds)
	Source       string                 // Calling function name for logging (e.g., "SetStatusOnline")
}

// StatusTransitionResult contains the outcome of a transition attempt
type StatusTransitionResult struct {
	Changed   bool          // Did the status actually change?
	OldStatus string        // Previous status
	NewStatus string        // New status (may differ from requested due to DND restoration)
	Status    *model.Status // The updated status object
	Reason    string        // Reason for the outcome (for logging)
}

// StatusTransitionManager handles all status transitions with consistent rules
type StatusTransitionManager struct {
	ps *PlatformService
}

// NewStatusTransitionManager creates a new status transition manager
func NewStatusTransitionManager(ps *PlatformService) *StatusTransitionManager {
	return &StatusTransitionManager{ps: ps}
}

// TransitionStatus attempts to transition a user's status according to the rules.
// This is the single entry point for ALL status changes when AccurateStatuses is enabled.
func (m *StatusTransitionManager) TransitionStatus(opts StatusTransitionOptions) StatusTransitionResult {
	if !*m.ps.Config().ServiceSettings.EnableUserStatuses {
		return StatusTransitionResult{Reason: "statuses_disabled"}
	}

	now := model.GetMillis()
	status := m.getOrCreateStatus(opts.UserID, opts.ChannelID, now)
	oldStatus := status.Status

	// Check if transition is blocked by rules
	if reason := m.checkTransitionBlocked(status, opts); reason != "" {
		return StatusTransitionResult{OldStatus: oldStatus, Status: status, Reason: reason}
	}

	// Determine actual new status (DND restoration may override requested status)
	newStatus, dndRestored := m.resolveNewStatus(status, opts)

	// No change needed
	if status.Status == newStatus {
		m.updateActivityOnly(status, opts, now)
		return StatusTransitionResult{OldStatus: oldStatus, Status: status, Reason: "no_change"}
	}

	// Apply the transition
	m.applyTransition(status, oldStatus, newStatus, opts, now, dndRestored)

	// Save and broadcast
	m.saveAndBroadcast(status, oldStatus, opts)

	return StatusTransitionResult{
		Changed:   true,
		OldStatus: oldStatus,
		NewStatus: newStatus,
		Status:    status,
		Reason:    m.transitionReason(dndRestored),
	}
}

// getOrCreateStatus retrieves existing status or creates a default one
func (m *StatusTransitionManager) getOrCreateStatus(userID, channelID string, now int64) *model.Status {
	status, err := m.ps.GetStatus(userID)
	if err != nil {
		return &model.Status{
			UserId:         userID,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: now,
			ActiveChannel:  channelID,
		}
	}
	return status
}

// checkTransitionBlocked returns a reason string if the transition should be blocked, empty string otherwise
func (m *StatusTransitionManager) checkTransitionBlocked(status *model.Status, opts StatusTransitionOptions) string {
	// Status pause: block all non-manual transitions for paused users
	if !opts.Manual && m.ps.IsUserStatusPaused(opts.UserID) {
		return "status_paused"
	}

	// Away is blocked for DND users who went Offline (preserves DND restoration)
	if opts.NewStatus == model.StatusAway && status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd {
		return "away_blocked_dnd_offline"
	}

	// DND/OOO can only be changed automatically to Offline (for inactivity timeout)
	if (status.Status == model.StatusDnd || status.Status == model.StatusOutOfOffice) &&
		!opts.Manual && opts.NewStatus != model.StatusOffline {
		return "dnd_ooo_protected"
	}

	// IMPORTANT: When AccurateStatuses is enabled, Manual flag should NEVER block transitions.
	// The server owns ALL status transitions. Manual is only set for logging/display purposes,
	// but does not protect any status from automatic changes.
	// This is intentionally a no-op - no manual status protection.

	return ""
}

// resolveNewStatus determines the actual new status, handling DND restoration
func (m *StatusTransitionManager) resolveNewStatus(status *model.Status, opts StatusTransitionOptions) (newStatus string, dndRestored bool) {
	// DND Restoration: Offline user with PrevStatus=DND going Online should restore DND
	if opts.NewStatus == model.StatusOnline &&
		status.Status == model.StatusOffline &&
		status.PrevStatus == model.StatusDnd &&
		!opts.Manual {
		return model.StatusDnd, true
	}
	return opts.NewStatus, false
}

// updateActivityOnly updates activity fields without changing status
func (m *StatusTransitionManager) updateActivityOnly(status *model.Status, opts StatusTransitionOptions, now int64) {
	// Status pause: skip LastActivityAt update for paused users
	if m.ps.IsUserStatusPaused(opts.UserID) {
		return
	}
	if opts.WindowActive || opts.ChannelID != "" {
		status.LastActivityAt = now
	}
	if opts.ChannelID != "" {
		status.ActiveChannel = opts.ChannelID
	}
}

// applyTransition modifies the status object with the new state
func (m *StatusTransitionManager) applyTransition(status *model.Status, oldStatus, newStatus string, opts StatusTransitionOptions, now int64, dndRestored bool) {
	status.Status = newStatus

	// Status pause: don't update LastActivityAt for paused users (even on manual changes)
	// Also don't update LastActivityAt for inactivity transitions - preserve the actual last activity time
	if !m.ps.IsUserStatusPaused(opts.UserID) && opts.Reason != TransitionReasonInactivity {
		status.LastActivityAt = now
	}

	if opts.ChannelID != "" {
		status.ActiveChannel = opts.ChannelID
	}

	// Set manual flag
	switch {
	case opts.Manual || dndRestored:
		status.Manual = true
	case newStatus == model.StatusOnline:
		status.Manual = false
	}

	// Handle DND-specific fields
	switch {
	case dndRestored:
		status.PrevStatus = ""
	case newStatus == model.StatusDnd && opts.DNDEndTime > 0:
		status.DNDEndTime = opts.DNDEndTime
		status.PrevStatus = oldStatus
	case newStatus == model.StatusOffline && oldStatus == model.StatusDnd:
		status.PrevStatus = model.StatusDnd
		status.Manual = false
	case newStatus != model.StatusDnd:
		status.DNDEndTime = 0
	}
}

// transitionReason returns the result reason based on whether DND was restored
func (m *StatusTransitionManager) transitionReason(dndRestored bool) string {
	if dndRestored {
		return "dnd_restored"
	}
	return "transitioned"
}

// saveAndBroadcast saves the status to cache/DB and broadcasts the change
func (m *StatusTransitionManager) saveAndBroadcast(status *model.Status, oldStatus string, opts StatusTransitionOptions) {
	// Add to cache
	m.ps.AddStatusCache(status)

	// Save to database
	if err := m.ps.Store.Status().SaveOrUpdate(status); err != nil {
		m.ps.Log().Warn("Failed to save status", mlog.String("user_id", status.UserId), mlog.Err(err))
	}

	// Broadcast
	m.ps.BroadcastStatus(status)
	if m.ps.sharedChannelService != nil {
		m.ps.sharedChannelService.NotifyUserStatusChanged(status)
	}

	// Log the change
	username := ""
	if user, userErr := m.ps.Store.User().Get(context.Background(), status.UserId); userErr == nil {
		username = user.Username
	}

	reason := m.mapTransitionReasonToLogReason(opts.Reason, oldStatus, status.Status)
	source := opts.Source
	if source == "" {
		source = "StatusTransitionManager" // Fallback if no source provided
	}
	m.ps.LogStatusChange(status.UserId, username, oldStatus, status.Status, reason, opts.Device, opts.WindowActive, opts.ChannelID, opts.Manual, source, status.LastActivityAt)
}

// mapTransitionReasonToLogReason converts transition reason to log reason constant
func (m *StatusTransitionManager) mapTransitionReasonToLogReason(reason StatusTransitionReason, oldStatus, newStatus string) string {
	switch reason {
	case TransitionReasonManual:
		return model.StatusLogReasonManual
	case TransitionReasonConnect:
		return model.StatusLogReasonConnect
	case TransitionReasonDisconnect:
		return model.StatusLogReasonDisconnect
	case TransitionReasonInactivity:
		return model.StatusLogReasonInactivity
	case TransitionReasonDNDExpired, TransitionReasonDNDInactivity:
		return model.StatusLogReasonDNDExpired
	case TransitionReasonActivity, TransitionReasonChannelView, TransitionReasonHeartbeat:
		if oldStatus == model.StatusOffline && newStatus == model.StatusDnd {
			return model.StatusLogReasonDNDRestored
		}
		if oldStatus == model.StatusAway {
			return model.StatusLogReasonWindowFocus
		}
		return model.StatusLogReasonHeartbeat
	default:
		return model.StatusLogReasonHeartbeat
	}
}
