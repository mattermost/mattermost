// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
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
