// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// StatusLog represents a status change event for debugging and monitoring.
type StatusLog struct {
	Id           string `json:"id"`
	CreateAt     int64  `json:"create_at"`
	UserID       string `json:"user_id"`
	Username     string `json:"username"`
	OldStatus    string `json:"old_status"`
	NewStatus    string `json:"new_status"`
	Reason       string `json:"reason"`        // e.g., "window_focus", "heartbeat", "inactivity", "manual", "offline_prevented"
	WindowActive bool   `json:"window_active"` // Whether the window was active at the time
	ChannelID    string `json:"channel_id,omitempty"`
}

// StatusLogReason constants
const (
	StatusLogReasonWindowFocus      = "window_focus"
	StatusLogReasonHeartbeat        = "heartbeat"
	StatusLogReasonInactivity       = "inactivity"
	StatusLogReasonManual           = "manual"
	StatusLogReasonOfflinePrevented = "offline_prevented"
	StatusLogReasonDisconnect       = "disconnect"
	StatusLogReasonConnect          = "connect"
)
