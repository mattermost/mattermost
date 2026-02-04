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
	result := StatusTransitionResult{
		Changed: false,
		Reason:  "no_change",
	}

	// Check if statuses are enabled
	if !*m.ps.Config().ServiceSettings.EnableUserStatuses {
		result.Reason = "statuses_disabled"
		return result
	}

	// Get current status
	now := model.GetMillis()
	status, err := m.ps.GetStatus(opts.UserID)
	if err != nil {
		// Create new status for user
		status = &model.Status{
			UserId:         opts.UserID,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: now,
			ActiveChannel:  opts.ChannelID,
		}
	}

	result.OldStatus = status.Status
	result.Status = status

	// Determine the actual new status (may be modified by rules)
	actualNewStatus := opts.NewStatus

	// Rule 1: DND Restoration - If going to Online from Offline+PrevStatus=DND, restore DND
	if opts.NewStatus == model.StatusOnline &&
		status.Status == model.StatusOffline &&
		status.PrevStatus == model.StatusDnd &&
		!opts.Manual {
		actualNewStatus = model.StatusDnd
		status.Manual = true
		status.PrevStatus = ""
		result.Reason = "dnd_restored"
	}

	// Rule 2: Manual status protection (unless force or NoOffline applies)
	if status.Manual && !opts.Manual && !opts.Force {
		// Check NoOffline exception
		if m.ps.Config().FeatureFlags.NoOffline &&
			status.Status == model.StatusOffline &&
			opts.NewStatus == model.StatusOnline {
			// NoOffline overrides manual for Offline->Online
		} else {
			result.Reason = "manual_status_protected"
			return result
		}
	}

	// Rule 3: Away protection for DND-Offline users
	if opts.NewStatus == model.StatusAway &&
		status.Status == model.StatusOffline &&
		status.PrevStatus == model.StatusDnd {
		result.Reason = "away_blocked_dnd_offline"
		return result
	}

	// Rule 4: DND/OOO can only be changed by automatic action to Offline
	if (status.Status == model.StatusDnd || status.Status == model.StatusOutOfOffice) &&
		!opts.Manual &&
		opts.NewStatus != model.StatusOffline {
		result.Reason = "dnd_ooo_protected"
		return result
	}

	// Check if status actually changes
	if status.Status == actualNewStatus {
		// Update activity time even if status doesn't change
		if opts.WindowActive || opts.ChannelID != "" {
			status.LastActivityAt = now
		}
		if opts.ChannelID != "" {
			status.ActiveChannel = opts.ChannelID
		}
		result.Reason = "no_change"
		return result
	}

	// Apply the transition
	status.Status = actualNewStatus
	status.LastActivityAt = now

	if opts.ChannelID != "" {
		status.ActiveChannel = opts.ChannelID
	}

	// Set manual flag based on transition type
	if opts.Manual {
		status.Manual = true
	} else if actualNewStatus == model.StatusOnline {
		status.Manual = false
	} else if actualNewStatus == model.StatusDnd && result.Reason == "dnd_restored" {
		status.Manual = true
	}

	// Handle DND-specific fields
	if actualNewStatus == model.StatusDnd && opts.DNDEndTime > 0 {
		status.DNDEndTime = opts.DNDEndTime
		status.PrevStatus = result.OldStatus
	} else if actualNewStatus == model.StatusOffline && result.OldStatus == model.StatusDnd {
		status.PrevStatus = model.StatusDnd
		status.Manual = false
	} else if actualNewStatus != model.StatusDnd {
		status.DNDEndTime = 0
	}

	result.Changed = true
	result.NewStatus = actualNewStatus

	// Save and broadcast
	m.saveAndBroadcast(status, result.OldStatus, opts)

	return result
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
	m.ps.LogStatusChange(status.UserId, username, oldStatus, status.Status, reason, opts.Device, opts.WindowActive, opts.ChannelID, opts.Manual, "StatusTransitionManager")
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
