// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// DefaultStatusLogBufferSize is the default maximum number of status logs to keep in memory
	DefaultStatusLogBufferSize = 500
)

// StatusLogBuffer is a thread-safe ring buffer for storing status logs.
type StatusLogBuffer struct {
	mu       sync.RWMutex
	buffer   []*model.StatusLog
	head     int
	count    int
	capacity int
}

// NewStatusLogBuffer creates a new status log buffer.
func NewStatusLogBuffer(capacity int) *StatusLogBuffer {
	if capacity <= 0 {
		capacity = DefaultStatusLogBufferSize
	}
	return &StatusLogBuffer{
		buffer:   make([]*model.StatusLog, capacity),
		capacity: capacity,
	}
}

// Add adds a status log to the buffer.
// If the buffer is full, the oldest log is replaced.
func (b *StatusLogBuffer) Add(statusLog *model.StatusLog) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.buffer[b.head] = statusLog
	b.head = (b.head + 1) % b.capacity
	if b.count < b.capacity {
		b.count++
	}
}

// GetAll returns all status logs in the buffer, newest first.
func (b *StatusLogBuffer) GetAll() []*model.StatusLog {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.count == 0 {
		return []*model.StatusLog{}
	}

	result := make([]*model.StatusLog, b.count)
	for i := 0; i < b.count; i++ {
		// Calculate index to get logs in reverse chronological order
		idx := (b.head - 1 - i + b.capacity) % b.capacity
		result[i] = b.buffer[idx]
	}
	return result
}

// Clear removes all status logs from the buffer.
func (b *StatusLogBuffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.buffer = make([]*model.StatusLog, b.capacity)
	b.head = 0
	b.count = 0
}

// Count returns the number of logs in the buffer.
func (b *StatusLogBuffer) Count() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.count
}

// GetStats returns statistics about status changes in the buffer.
func (b *StatusLogBuffer) GetStats() map[string]int {
	b.mu.RLock()
	defer b.mu.RUnlock()

	stats := map[string]int{
		"total":   b.count,
		"online":  0,
		"away":    0,
		"dnd":     0,
		"offline": 0,
	}

	for i := 0; i < b.count; i++ {
		idx := (b.head - 1 - i + b.capacity) % b.capacity
		if b.buffer[idx] != nil {
			switch b.buffer[idx].NewStatus {
			case model.StatusOnline:
				stats["online"]++
			case model.StatusAway:
				stats["away"]++
			case model.StatusDnd:
				stats["dnd"]++
			case model.StatusOffline:
				stats["offline"]++
			}
		}
	}

	return stats
}

// Resize changes the capacity of the buffer.
// If the new capacity is smaller, oldest entries may be lost.
func (b *StatusLogBuffer) Resize(newCapacity int) {
	if newCapacity <= 0 {
		newCapacity = DefaultStatusLogBufferSize
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// Get all existing logs
	existingLogs := make([]*model.StatusLog, b.count)
	for i := 0; i < b.count; i++ {
		idx := (b.head - 1 - i + b.capacity) % b.capacity
		existingLogs[i] = b.buffer[idx]
	}

	// Create new buffer
	b.buffer = make([]*model.StatusLog, newCapacity)
	b.capacity = newCapacity

	// Copy logs back (newest first, but we need to add them in order)
	copyCount := min(b.count, newCapacity)
	b.count = 0
	b.head = 0

	// Add logs back in chronological order (oldest first)
	for i := copyCount - 1; i >= 0; i-- {
		b.buffer[b.head] = existingLogs[i]
		b.head = (b.head + 1) % b.capacity
		b.count++
	}
}

// LogStatusChange adds a status change to the buffer and broadcasts it via WebSocket.
func (ps *PlatformService) LogStatusChange(userID, username, oldStatus, newStatus, reason string, windowActive bool, channelID string) {
	// Debug: Log entry into function
	accurateStatusesEnabled := ps.Config().FeatureFlags.AccurateStatuses
	statusLogsEnabled := *ps.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs

	ps.Log().Debug("LogStatusChange called",
		mlog.String("user_id", userID),
		mlog.String("old_status", oldStatus),
		mlog.String("new_status", newStatus),
		mlog.Bool("accurate_statuses_enabled", accurateStatusesEnabled),
		mlog.Bool("status_logs_enabled", statusLogsEnabled),
	)

	// Only log if AccurateStatuses feature is enabled AND status logs are enabled
	if !accurateStatusesEnabled {
		ps.Log().Debug("LogStatusChange skipped: AccurateStatuses disabled")
		return
	}
	if !statusLogsEnabled {
		ps.Log().Debug("LogStatusChange skipped: EnableStatusLogs disabled")
		return
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
	}

	// Add to buffer
	ps.statusLogBuffer.Add(statusLog)

	// Broadcast to admins via WebSocket
	event := model.NewWebSocketEvent(model.WebsocketEventStatusLog, "", "", "", nil, "")
	event.Add("status_log", statusLog)
	event.GetBroadcast().ContainsSensitiveData = true // Admin-only
	ps.Publish(event)

	ps.Log().Debug("Status change logged",
		mlog.String("user_id", userID),
		mlog.String("username", username),
		mlog.String("old_status", oldStatus),
		mlog.String("new_status", newStatus),
		mlog.String("reason", reason),
		mlog.Bool("window_active", windowActive),
	)
}

// GetStatusLogs returns all status logs from the buffer.
func (ps *PlatformService) GetStatusLogs() []*model.StatusLog {
	return ps.statusLogBuffer.GetAll()
}

// ClearStatusLogs clears all status logs from the buffer.
func (ps *PlatformService) ClearStatusLogs() {
	ps.statusLogBuffer.Clear()
}

// GetStatusLogStats returns statistics about the status logs.
func (ps *PlatformService) GetStatusLogStats() map[string]int {
	return ps.statusLogBuffer.GetStats()
}

// ResizeStatusLogBuffer resizes the status log buffer to the configured size.
func (ps *PlatformService) ResizeStatusLogBuffer() {
	maxLogs := *ps.Config().MattermostExtendedSettings.Statuses.MaxStatusLogs
	ps.statusLogBuffer.Resize(maxLogs)
}
