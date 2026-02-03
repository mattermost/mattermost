// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// StatusLog represents a status change or activity event for debugging and monitoring.
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
	Device       string `json:"device,omitempty"` // Client type: "web", "desktop", "mobile", "api", "unknown"
	LogType      string `json:"log_type"`         // "status_change" or "activity"
	Trigger      string `json:"trigger,omitempty"` // Human-readable trigger for activity logs (e.g., "Window Active", "Loaded #general")
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
