// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// StatusLogCleanupInterval is how often the status log cleanup runs
	StatusLogCleanupInterval = 1 * time.Hour
)

// LogStatusChange saves a status change to the database and broadcasts it via WebSocket.
// The source parameter identifies which function triggered this log (e.g., "SetStatusOnline").
func (ps *PlatformService) LogStatusChange(userID, username, oldStatus, newStatus, reason, device string, windowActive bool, channelID string, manual bool, source string) {
	// Only log if status logs are enabled
	if !*ps.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		return
	}

	// Default device to unknown if empty
	if device == "" {
		device = model.StatusLogDeviceUnknown
	}

	// Generate trigger text based on reason
	var trigger string
	switch reason {
	case model.StatusLogReasonWindowFocus:
		trigger = model.StatusLogTriggerWindowActive
	case model.StatusLogReasonInactivity:
		// Include the inactivity timeout in the trigger
		inactivityMinutes := *ps.Config().MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes
		trigger = fmt.Sprintf("Window Inactive for %dm", inactivityMinutes)
	case model.StatusLogReasonHeartbeat:
		trigger = model.StatusLogTriggerHeartbeat
	default:
		trigger = ""
	}

	statusLog := &model.StatusLog{
		Id:           model.NewId(),
		CreateAt:     model.GetMillis(),
		UserID:       userID,
		Username:     username,
		OldStatus:    oldStatus,
		NewStatus:    newStatus,
		Reason:       reason,
		WindowActive: windowActive,
		ChannelID:    channelID,
		Device:       device,
		LogType:      model.StatusLogTypeStatusChange,
		Trigger:      trigger,
		Manual:       manual,
		Source:       source,
	}

	// Save to database
	if err := ps.Store.StatusLog().Save(statusLog); err != nil {
		ps.logger.Warn("Failed to save status log to database", mlog.Err(err))
	}

	// Broadcast to admins via WebSocket
	event := model.NewWebSocketEvent(model.WebsocketEventStatusLog, "", "", "", nil, "")
	event.Add("status_log", statusLog)
	event.GetBroadcast().ContainsSensitiveData = true // Admin-only
	ps.Publish(event)
}

// LogActivityUpdate logs an activity update (LastActivityAt change) without status change.
// This tracks what triggers keep users active.
// The source parameter identifies which function triggered this log (e.g., "UpdateActivityFromHeartbeat").
// The channelType parameter is the channel type (e.g., "O", "P", "D", "G") used to format display names.
// The lastActivityAt parameter is the timestamp that was set (for debugging time jumps).
func (ps *PlatformService) LogActivityUpdate(userID, username, currentStatus, device string, windowActive bool, channelID, channelName, channelType, trigger, source string, lastActivityAt int64) {
	// Only log if status logs are enabled
	if !*ps.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		return
	}

	// Default device to unknown if empty
	if device == "" {
		device = model.StatusLogDeviceUnknown
	}

	// Format channel display based on type (# for channels, @ for DMs)
	channelDisplay := ""
	if channelName != "" {
		if channelType == string(model.ChannelTypeDirect) || channelType == string(model.ChannelTypeGroup) {
			channelDisplay = "@" + channelName
		} else {
			channelDisplay = "#" + channelName
		}
	}

	// Build trigger string with channel name if provided
	displayTrigger := trigger
	switch trigger {
	case model.StatusLogTriggerChannelView:
		if channelDisplay != "" {
			displayTrigger = "Loaded " + channelDisplay
		}
	case model.StatusLogTriggerFetchHistory:
		if channelDisplay != "" {
			displayTrigger = "Fetched history of " + channelDisplay
		}
	case model.StatusLogTriggerActiveChannel:
		if channelDisplay != "" {
			displayTrigger = "Active Channel set to " + channelDisplay
		}
	case model.StatusLogTriggerSendMessage:
		if channelDisplay != "" {
			displayTrigger = "Sent message in " + channelDisplay
		}
	case model.StatusLogTriggerWindowInactive:
		// Include the inactivity timeout in the trigger
		inactivityMinutes := *ps.Config().MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes
		displayTrigger = fmt.Sprintf("Window Inactive for %dm", inactivityMinutes)
	}

	statusLog := &model.StatusLog{
		Id:             model.NewId(),
		CreateAt:       model.GetMillis(),
		UserID:         userID,
		Username:       username,
		OldStatus:      currentStatus, // Same status for activity logs
		NewStatus:      currentStatus,
		Reason:         model.StatusLogReasonHeartbeat,
		WindowActive:   windowActive,
		ChannelID:      channelID,
		Device:         device,
		LogType:        model.StatusLogTypeActivity,
		Trigger:        displayTrigger,
		Source:         source,
		LastActivityAt: lastActivityAt,
	}

	// Save to database
	if err := ps.Store.StatusLog().Save(statusLog); err != nil {
		ps.logger.Warn("Failed to save activity log to database", mlog.Err(err))
	}

	// Broadcast to admins via WebSocket
	event := model.NewWebSocketEvent(model.WebsocketEventStatusLog, "", "", "", nil, "")
	event.Add("status_log", statusLog)
	event.GetBroadcast().ContainsSensitiveData = true // Admin-only
	ps.Publish(event)
}

// GetStatusLogs returns status logs from the database with default pagination.
func (ps *PlatformService) GetStatusLogs() []*model.StatusLog {
	return ps.GetStatusLogsWithOptions(model.StatusLogGetOptions{
		Page:    0,
		PerPage: 500, // Default page size for backward compatibility
	})
}

// GetStatusLogsWithOptions returns status logs from the database with custom options.
func (ps *PlatformService) GetStatusLogsWithOptions(options model.StatusLogGetOptions) []*model.StatusLog {
	logs, err := ps.Store.StatusLog().Get(options)
	if err != nil {
		ps.logger.Warn("Failed to get status logs from database", mlog.Err(err))
		return []*model.StatusLog{}
	}
	return logs
}

// GetStatusLogCount returns the total count of status logs matching the options.
func (ps *PlatformService) GetStatusLogCount(options model.StatusLogGetOptions) int64 {
	count, err := ps.Store.StatusLog().GetCount(options)
	if err != nil {
		ps.logger.Warn("Failed to get status log count from database", mlog.Err(err))
		return 0
	}
	return count
}

// ClearStatusLogs clears all status logs from the database.
func (ps *PlatformService) ClearStatusLogs() {
	if err := ps.Store.StatusLog().DeleteAll(); err != nil {
		ps.logger.Warn("Failed to clear status logs from database", mlog.Err(err))
	}
}

// GetStatusLogStats returns statistics about the status logs.
func (ps *PlatformService) GetStatusLogStats() map[string]int {
	return ps.GetStatusLogStatsWithOptions(model.StatusLogGetOptions{})
}

// GetStatusLogStatsWithOptions returns statistics about the status logs with custom options.
func (ps *PlatformService) GetStatusLogStatsWithOptions(options model.StatusLogGetOptions) map[string]int {
	stats, err := ps.Store.StatusLog().GetStats(options)
	if err != nil {
		ps.logger.Warn("Failed to get status log stats from database", mlog.Err(err))
		return map[string]int{
			"total":   0,
			"online":  0,
			"away":    0,
			"dnd":     0,
			"offline": 0,
		}
	}

	// Convert int64 to int for backward compatibility
	return map[string]int{
		"total":   int(stats["total"]),
		"online":  int(stats["online"]),
		"away":    int(stats["away"]),
		"dnd":     int(stats["dnd"]),
		"offline": int(stats["offline"]),
	}
}

// CleanupOldStatusLogs removes status logs older than the retention period.
// This should be called periodically (e.g., once per hour).
func (ps *PlatformService) CleanupOldStatusLogs() {
	// Get retention days from config (default to 7 days if not set)
	retentionDays := *ps.Config().MattermostExtendedSettings.Statuses.StatusLogRetentionDays
	if retentionDays <= 0 {
		// Retention disabled, don't delete anything
		return
	}

	// Calculate cutoff timestamp
	cutoffTime := model.GetMillis() - int64(retentionDays*24*60*60*1000)

	deleted, err := ps.Store.StatusLog().DeleteOlderThan(cutoffTime)
	if err != nil {
		ps.logger.Warn("Failed to cleanup old status logs", mlog.Err(err))
		return
	}

	if deleted > 0 {
		ps.logger.Info("Cleaned up old status logs",
			mlog.Int("deleted_count", deleted),
			mlog.Int("retention_days", retentionDays))
	}
}

// statusLogCleanupLoop runs periodically to clean up old status logs based on retention settings.
func (ps *PlatformService) statusLogCleanupLoop() {
	ticker := time.NewTicker(StatusLogCleanupInterval)
	defer ticker.Stop()

	// Run initial cleanup on startup (after a short delay to ensure DB is ready)
	time.Sleep(30 * time.Second)
	ps.CleanupOldStatusLogs()

	for {
		select {
		case <-ticker.C:
			ps.CleanupOldStatusLogs()
		case <-ps.goroutineExitSignal:
			return
		}
	}
}
