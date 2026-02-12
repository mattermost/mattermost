// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// StatusLogCleanupInterval is how often the status log cleanup runs
	StatusLogCleanupInterval = 1 * time.Hour
	// StatusEnforcementInterval is how often the status enforcement loop runs (inactivity + DND timeouts)
	StatusEnforcementInterval = 1 * time.Minute
)

// LogStatusChange saves a status change to the database and broadcasts it via WebSocket.
// The source parameter identifies which function triggered this log (e.g., "SetStatusOnline").
// The lastActivityAt parameter is the user's LastActivityAt value at the time of the change.
func (ps *PlatformService) LogStatusChange(userID, username, oldStatus, newStatus, reason, device string, windowActive bool, channelID string, manual bool, source string, lastActivityAt int64) {
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
		Id:             model.NewId(),
		CreateAt:       model.GetMillis(),
		UserID:         userID,
		Username:       username,
		OldStatus:      oldStatus,
		NewStatus:      newStatus,
		Reason:         reason,
		WindowActive:   windowActive,
		ChannelID:      channelID,
		Device:         device,
		LogType:        model.StatusLogTypeStatusChange,
		Trigger:        trigger,
		Manual:         manual,
		Source:         source,
		LastActivityAt: lastActivityAt,
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

	// Check notification rules and send push notifications
	ps.processStatusNotificationRules(statusLog)
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

	// Check notification rules and send push notifications
	ps.processStatusNotificationRules(statusLog)
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

// processStatusNotificationRules checks notification rules for the given status log
// and sends push notifications to recipients whose rules match.
func (ps *PlatformService) processStatusNotificationRules(log *model.StatusLog) {
	// Skip if status logs are not enabled (rules won't work without logging anyway)
	if !*ps.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		return
	}

	// Skip if push notification callback is not set
	if ps.sendStatusNotificationPushFunc == nil {
		return
	}

	// Get all enabled rules for the watched user
	rules, err := ps.Store.StatusNotificationRule().GetByWatchedUser(log.UserID)
	if err != nil {
		ps.logger.Warn("Failed to get notification rules for user",
			mlog.String("user_id", log.UserID),
			mlog.Err(err))
		return
	}

	if len(rules) == 0 {
		return
	}

	// Process each rule asynchronously
	ps.Go(func() {
		for _, rule := range rules {
			if !rule.Enabled || rule.DeleteAt > 0 {
				continue
			}

			// Check if the log matches the rule's event filters
			if !rule.MatchesLog(log) {
				continue
			}

			// Build the notification message
			message := ps.buildStatusNotificationMessage(log)
			if message == "" {
				continue
			}

			// Send the push notification
			ps.sendStatusNotificationPushFunc(rule.RecipientUserID, log.Username, message)

			ps.logger.Debug("Sent status notification push",
				mlog.String("rule_id", rule.Id),
				mlog.String("rule_name", rule.Name),
				mlog.String("watched_user", log.Username),
				mlog.String("recipient_user_id", rule.RecipientUserID),
				mlog.String("log_type", log.LogType),
				mlog.String("message", message))
		}
	})
}

// buildStatusNotificationMessage creates a human-readable message for a status log event.
func (ps *PlatformService) buildStatusNotificationMessage(log *model.StatusLog) string {
	switch log.LogType {
	case model.StatusLogTypeStatusChange:
		return ps.buildStatusChangeMessage(log)
	case model.StatusLogTypeActivity:
		return ps.buildActivityMessage(log)
	default:
		return ""
	}
}

// buildStatusChangeMessage creates a message for status change events.
func (ps *PlatformService) buildStatusChangeMessage(log *model.StatusLog) string {
	switch log.NewStatus {
	case model.StatusOnline:
		return fmt.Sprintf("%s is now online", log.Username)
	case model.StatusAway:
		return fmt.Sprintf("%s is now away", log.Username)
	case model.StatusDnd:
		return fmt.Sprintf("%s is now on Do Not Disturb", log.Username)
	case model.StatusOffline:
		return fmt.Sprintf("%s is now offline", log.Username)
	default:
		return fmt.Sprintf("%s changed status to %s", log.Username, log.NewStatus)
	}
}

// buildActivityMessage creates a message for activity events.
func (ps *PlatformService) buildActivityMessage(log *model.StatusLog) string {
	trigger := log.Trigger

	// Extract channel (#channel) or DM (@user) target from trigger
	target := extractChannelOrDMTarget(trigger)

	// Handle specific activity types with human-friendly messages
	if strings.Contains(trigger, "Sent message in ") {
		if strings.HasPrefix(target, "@") {
			return fmt.Sprintf("%s messaged %s", log.Username, target)
		}
		if target != "" {
			return fmt.Sprintf("%s messaged %s", log.Username, target)
		}
		return fmt.Sprintf("%s sent a message", log.Username)
	}

	if strings.Contains(trigger, "Loaded ") {
		if strings.HasPrefix(target, "@") {
			return fmt.Sprintf("%s opened chat with %s", log.Username, target)
		}
		if target != "" {
			return fmt.Sprintf("%s opened %s", log.Username, target)
		}
		return fmt.Sprintf("%s opened a channel", log.Username)
	}

	if strings.Contains(trigger, "Active Channel set to ") {
		if strings.HasPrefix(target, "@") {
			return fmt.Sprintf("%s is viewing %s", log.Username, target)
		}
		if target != "" {
			return fmt.Sprintf("%s is viewing %s", log.Username, target)
		}
		return fmt.Sprintf("%s switched channels", log.Username)
	}

	if strings.Contains(trigger, "Fetched history of ") {
		if strings.HasPrefix(target, "@") {
			return fmt.Sprintf("%s scrolled in %s", log.Username, target)
		}
		if target != "" {
			return fmt.Sprintf("%s scrolled in %s", log.Username, target)
		}
		return fmt.Sprintf("%s scrolled history", log.Username)
	}

	if log.Reason == model.StatusLogReasonWindowFocus {
		return fmt.Sprintf("%s is active", log.Username)
	}

	// Fallback: use the trigger directly if available
	if trigger != "" {
		return fmt.Sprintf("%s: %s", log.Username, trigger)
	}

	return fmt.Sprintf("%s had activity", log.Username)
}

// extractChannelOrDMTarget extracts "#channel" or "@user" from a trigger string.
// Returns empty string if no target found.
func extractChannelOrDMTarget(trigger string) string {
	// Look for # (channel) - use LastIndex in case there are multiple
	if idx := strings.LastIndex(trigger, "#"); idx != -1 {
		return trigger[idx:]
	}
	// Look for @ (DM)
	if idx := strings.LastIndex(trigger, "@"); idx != -1 {
		return trigger[idx:]
	}
	return ""
}

// statusEnforcementLoop runs periodically to enforce status timeouts server-side.
// It runs both inactivity checks (Online→Away) and DND timeout checks (DND→Offline).
func (ps *PlatformService) statusEnforcementLoop() {
	ticker := time.NewTicker(StatusEnforcementInterval)
	defer ticker.Stop()

	// Wait a bit on startup to ensure everything is ready
	time.Sleep(30 * time.Second)

	for {
		select {
		case <-ticker.C:
			ps.CheckInactivityTimeouts()
			ps.CheckDNDTimeouts()
		case <-ps.goroutineExitSignal:
			return
		}
	}
}

// CheckInactivityTimeouts checks for Online users who have exceeded the inactivity
// timeout and transitions them to Away via StatusTransitionManager.
// Uses Force to override manual status protection — AccurateStatuses enforces real activity.
func (ps *PlatformService) CheckInactivityTimeouts() {
	// Skip if AccurateStatuses feature is disabled
	if !ps.Config().FeatureFlags.AccurateStatuses {
		return
	}

	// Get inactivity timeout from config (in minutes)
	timeoutMinutes := *ps.Config().MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes
	if timeoutMinutes <= 0 {
		// Inactivity timeout disabled
		return
	}

	// Calculate cutoff time
	now := model.GetMillis()
	cutoffTime := now - int64(timeoutMinutes)*60*1000

	// Get all Online users who have been inactive longer than the timeout
	statuses, err := ps.Store.Status().GetOnlineUsersInactiveSince(cutoffTime)
	if err != nil {
		ps.logger.Warn("Failed to get inactive Online users for timeout check", mlog.Err(err))
		return
	}

	if len(statuses) == 0 {
		return
	}

	ps.logger.Debug("Checking inactivity timeouts",
		mlog.Int("timeout_minutes", timeoutMinutes),
		mlog.Int("users_to_check", len(statuses)))

	// Transition each user to Away via StatusTransitionManager
	for _, status := range statuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    status.UserId,
			NewStatus: model.StatusAway,
			Reason:    TransitionReasonInactivity,
			Manual:    false,
			Force:     true, // AccurateStatuses overrides manual status protection
			Source:    "CheckInactivityTimeouts",
		})

		if result.Changed {
			ps.logger.Info("Set Online user to Away due to server-side inactivity timeout",
				mlog.String("user_id", status.UserId),
				mlog.Int("timeout_minutes", timeoutMinutes))
		}
	}
}

// CheckDNDTimeouts checks for DND users who have exceeded the inactivity timeout
// and transitions them to Offline via StatusTransitionManager (PrevStatus = DND is preserved
// so they can be restored when active again).
func (ps *PlatformService) CheckDNDTimeouts() {
	// Skip if AccurateStatuses feature is disabled
	if !ps.Config().FeatureFlags.AccurateStatuses {
		return
	}

	// Get DND inactivity timeout from config (in minutes)
	dndTimeoutMinutes := *ps.Config().MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes
	if dndTimeoutMinutes <= 0 {
		// DND timeout disabled
		return
	}

	// Calculate cutoff time
	now := model.GetMillis()
	cutoffTime := now - int64(dndTimeoutMinutes)*60*1000

	// Get all DND users who have been inactive longer than the timeout
	statuses, err := ps.Store.Status().GetDNDUsersInactiveSince(cutoffTime)
	if err != nil {
		ps.logger.Warn("Failed to get DND users for timeout check", mlog.Err(err))
		return
	}

	if len(statuses) == 0 {
		return
	}

	ps.logger.Debug("Checking DND timeouts",
		mlog.Int("dnd_timeout_minutes", dndTimeoutMinutes),
		mlog.Int("users_to_check", len(statuses)))

	// Transition each user to Offline via StatusTransitionManager
	for _, status := range statuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    status.UserId,
			NewStatus: model.StatusOffline,
			Reason:    TransitionReasonDNDInactivity,
			Manual:    false,
			Source:    "CheckDNDTimeouts",
		})

		if result.Changed {
			ps.logger.Info("Set DND user to Offline due to inactivity timeout",
				mlog.String("user_id", status.UserId),
				mlog.Int("timeout_minutes", dndTimeoutMinutes))
		}
	}
}
