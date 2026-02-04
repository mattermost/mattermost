// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// StatusLog represents a status change or activity event for debugging and monitoring.
type StatusLog struct {
	Id             string `json:"id" db:"id"`
	CreateAt       int64  `json:"create_at" db:"createat"`
	UserID         string `json:"user_id" db:"userid"`
	Username       string `json:"username" db:"username"`
	OldStatus      string `json:"old_status" db:"oldstatus"`
	NewStatus      string `json:"new_status" db:"newstatus"`
	Reason         string `json:"reason" db:"reason"`                   // e.g., "window_focus", "heartbeat", "inactivity", "manual", "offline_prevented"
	WindowActive   bool   `json:"window_active" db:"windowactive"`      // Whether the window was active at the time
	ChannelID      string `json:"channel_id,omitempty" db:"channelid"`
	Device         string `json:"device,omitempty" db:"device"`         // Client type: "web", "desktop", "mobile", "api", "unknown"
	LogType        string `json:"log_type" db:"logtype"`                // "status_change" or "activity"
	Trigger        string `json:"trigger,omitempty" db:"trigger"`       // Human-readable trigger for activity logs (e.g., "Window Active", "Loaded #general")
	Manual         bool   `json:"manual" db:"manual"`                   // Whether this status change was triggered by manual user action (vs automatic)
	Source         string `json:"source,omitempty" db:"source"`         // Code location that triggered this log (e.g., "SetStatusOnline", "UpdateActivityFromHeartbeat")
	LastActivityAt int64  `json:"last_activity_at,omitempty" db:"lastactivityat"` // The LastActivityAt timestamp that was set (for debugging time jumps)
}

// StatusLogType constants
const (
	StatusLogTypeStatusChange = "status_change"
	StatusLogTypeActivity     = "activity"
)

// StatusLogDevice constants
const (
	StatusLogDeviceWeb     = "web"
	StatusLogDeviceDesktop = "desktop"
	StatusLogDeviceMobile  = "mobile"
	StatusLogDeviceAPI     = "api"
	StatusLogDeviceUnknown = "unknown"
)

// StatusLogReason constants
const (
	StatusLogReasonWindowFocus      = "window_focus"
	StatusLogReasonHeartbeat        = "heartbeat"
	StatusLogReasonInactivity       = "inactivity"
	StatusLogReasonManual           = "manual"
	StatusLogReasonOfflinePrevented = "offline_prevented"
	StatusLogReasonDisconnect       = "disconnect"
	StatusLogReasonConnect          = "connect"
	StatusLogReasonDNDExpired       = "dnd_inactivity"
	StatusLogReasonDNDRestored      = "dnd_restored"
)

// StatusLogTrigger constants for activity logs
const (
	StatusLogTriggerWindowActive   = "Window Active"
	StatusLogTriggerWindowInactive = "Window Inactive"
	StatusLogTriggerHeartbeat      = "Heartbeat"
	StatusLogTriggerChannelView    = "Channel View"
	StatusLogTriggerWebSocket      = "WebSocket Message"
	StatusLogTriggerSetActivity    = "Set Activity"
	StatusLogTriggerActiveChannel  = "Active Channel"
	StatusLogTriggerMarkUnread     = "Mark Unread"
	StatusLogTriggerSendMessage    = "Send Message"
	StatusLogTriggerFetchHistory   = "Fetch History"
)

// StatusLogGetOptions contains options for retrieving status logs.
type StatusLogGetOptions struct {
	// UserID filters logs by user ID (optional).
	UserID string
	// Username filters logs by username (optional, case-insensitive).
	Username string
	// LogType filters by log type: "status_change" or "activity" (optional).
	LogType string
	// Status filters by new_status value: "online", "away", "dnd", "offline" (optional).
	Status string
	// Since filters logs created after this timestamp in milliseconds (optional).
	Since int64
	// Until filters logs created before this timestamp in milliseconds (optional).
	Until int64
	// Search performs text search across username, reason, and trigger fields (optional).
	Search string
	// Page is the page number for pagination (0-indexed).
	Page int
	// PerPage is the number of results per page.
	PerPage int
}
