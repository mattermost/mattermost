// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// ErrorLogBufferSize is the maximum number of errors to keep in memory
	ErrorLogBufferSize = 1000
)

// ErrorLogBuffer is a thread-safe ring buffer for storing error logs.
type ErrorLogBuffer struct {
	mu       sync.RWMutex
	buffer   []*model.ErrorLog
	head     int
	count    int
	capacity int
}

// NewErrorLogBuffer creates a new error log buffer.
func NewErrorLogBuffer(capacity int) *ErrorLogBuffer {
	if capacity <= 0 {
		capacity = ErrorLogBufferSize
	}
	return &ErrorLogBuffer{
		buffer:   make([]*model.ErrorLog, capacity),
		capacity: capacity,
	}
}

// Add adds an error log to the buffer.
// If the buffer is full, the oldest error is replaced.
func (b *ErrorLogBuffer) Add(errorLog *model.ErrorLog) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.buffer[b.head] = errorLog
	b.head = (b.head + 1) % b.capacity
	if b.count < b.capacity {
		b.count++
	}
}

// GetAll returns all error logs in the buffer, newest first.
func (b *ErrorLogBuffer) GetAll() []*model.ErrorLog {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.count == 0 {
		return []*model.ErrorLog{}
	}

	result := make([]*model.ErrorLog, b.count)
	for i := 0; i < b.count; i++ {
		// Calculate index to get errors in reverse chronological order
		idx := (b.head - 1 - i + b.capacity) % b.capacity
		result[i] = b.buffer[idx]
	}
	return result
}

// Clear removes all error logs from the buffer.
func (b *ErrorLogBuffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.buffer = make([]*model.ErrorLog, b.capacity)
	b.head = 0
	b.count = 0
}

// Count returns the number of errors in the buffer.
func (b *ErrorLogBuffer) Count() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.count
}

// GetStats returns statistics about errors in the buffer.
func (b *ErrorLogBuffer) GetStats() map[string]int {
	b.mu.RLock()
	defer b.mu.RUnlock()

	stats := map[string]int{
		"total": b.count,
		"api":   0,
		"js":    0,
	}

	for i := 0; i < b.count; i++ {
		idx := (b.head - 1 - i + b.capacity) % b.capacity
		if b.buffer[idx] != nil {
			switch b.buffer[idx].Type {
			case model.ErrorLogTypeAPI:
				stats["api"]++
			case model.ErrorLogTypeJS:
				stats["js"]++
			}
		}
	}

	return stats
}

// LogError adds an error to the buffer and broadcasts it via WebSocket.
func (ps *PlatformService) LogError(errorLog *model.ErrorLog) {
	// Only log if the feature is enabled
	if !ps.Config().FeatureFlags.ErrorLogDashboard {
		return
	}

	// Add to buffer
	ps.errorLogBuffer.Add(errorLog)

	// Broadcast to admins via WebSocket
	event := model.NewWebSocketEvent(model.WebsocketEventErrorLogged, "", "", "", nil, "")
	event.Add("error", errorLog)
	event.GetBroadcast().ContainsSensitiveData = true // Admin-only
	ps.Publish(event)

	ps.Log().Debug("Error logged",
		mlog.String("type", errorLog.Type),
		mlog.String("user_id", errorLog.UserId),
		mlog.String("message", errorLog.Message),
	)
}

// GetErrorLogs returns all error logs from the buffer.
func (ps *PlatformService) GetErrorLogs() []*model.ErrorLog {
	return ps.errorLogBuffer.GetAll()
}

// ClearErrorLogs clears all error logs from the buffer.
func (ps *PlatformService) ClearErrorLogs() {
	ps.errorLogBuffer.Clear()
}

// GetErrorLogStats returns statistics about the error logs.
func (ps *PlatformService) GetErrorLogStats() map[string]int {
	return ps.errorLogBuffer.GetStats()
}
