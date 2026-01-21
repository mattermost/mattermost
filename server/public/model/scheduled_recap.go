// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Day-of-week bitmask constants following Go's time.Weekday (Sunday=0)
const (
	Sunday    = 1 << 0 // 1
	Monday    = 1 << 1 // 2
	Tuesday   = 1 << 2 // 4
	Wednesday = 1 << 3 // 8
	Thursday  = 1 << 4 // 16
	Friday    = 1 << 5 // 32
	Saturday  = 1 << 6 // 64

	Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday // 62
	Weekend  = Saturday | Sunday                                // 65
	EveryDay = Weekdays | Weekend                               // 127
)

// Channel mode constants
const (
	ChannelModeSpecific   = "specific"
	ChannelModeAllUnreads = "all_unreads"
)

// Time period constants
const (
	TimePeriodLast24h       = "last_24h"
	TimePeriodLastWeek      = "last_week"
	TimePeriodSinceLastRead = "since_last_read"
)

// Validation constants
const (
	ScheduledRecapTitleMaxLength = 255
	ScheduledRecapMinDaysOfWeek  = 1
	ScheduledRecapMaxDaysOfWeek  = 127
)

// timeOfDayRegex validates HH:MM format (00:00 to 23:59)
var timeOfDayRegex = regexp.MustCompile(`^([0-1][0-9]|2[0-3]):([0-5][0-9])$`)

// ScheduledRecap represents a user's scheduled recap configuration
type ScheduledRecap struct {
	Id     string `json:"id"`
	UserId string `json:"user_id"`
	Title  string `json:"title"`

	// Schedule configuration (user intent)
	DaysOfWeek int    `json:"days_of_week"` // Bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
	TimeOfDay  string `json:"time_of_day"`  // HH:MM format (e.g., "09:00")
	Timezone   string `json:"timezone"`     // IANA timezone (e.g., "America/New_York")
	TimePeriod string `json:"time_period"`  // "last_24h", "last_week", "since_last_read"

	// Schedule state (computed)
	NextRunAt int64 `json:"next_run_at"` // UTC milliseconds, computed from schedule + timezone
	LastRunAt int64 `json:"last_run_at"` // UTC milliseconds, updated after each run
	RunCount  int   `json:"run_count"`   // Number of times this schedule has executed

	// Channel configuration
	ChannelMode string   `json:"channel_mode"`          // "specific" or "all_unreads"
	ChannelIds  []string `json:"channel_ids,omitempty"` // JSON array of channel IDs (when mode = "specific")

	// AI configuration
	CustomInstructions string `json:"custom_instructions,omitempty"` // Custom AI instructions
	AgentId            string `json:"agent_id"`                      // AI agent to use

	// Schedule type and state
	IsRecurring bool `json:"is_recurring"` // false for "run once" schedules
	Enabled     bool `json:"enabled"`      // false when paused

	// Standard timestamps
	CreateAt int64 `json:"create_at"`
	UpdateAt int64 `json:"update_at"`
	DeleteAt int64 `json:"delete_at"` // Soft delete
}

// ComputeNextRunAt calculates the next scheduled execution time in UTC milliseconds.
// It uses the user's timezone to determine the correct local time, handling DST automatically.
func (sr *ScheduledRecap) ComputeNextRunAt(fromTime time.Time) (int64, error) {
	// Load user's timezone
	loc, err := time.LoadLocation(sr.Timezone)
	if err != nil {
		return 0, NewAppError("ScheduledRecap.ComputeNextRunAt", "model.scheduled_recap.compute_next_run.timezone.app_error", nil, "timezone="+sr.Timezone, http.StatusBadRequest)
	}

	// Validate time of day format using regex
	if !timeOfDayRegex.MatchString(sr.TimeOfDay) {
		return 0, NewAppError("ScheduledRecap.ComputeNextRunAt", "model.scheduled_recap.compute_next_run.time_format.app_error", nil, "time_of_day="+sr.TimeOfDay, http.StatusBadRequest)
	}

	// Parse time of day
	parts := strings.Split(sr.TimeOfDay, ":")
	hour, _ := strconv.Atoi(parts[0])
	minute, _ := strconv.Atoi(parts[1])

	// Validate days of week
	if sr.DaysOfWeek < ScheduledRecapMinDaysOfWeek || sr.DaysOfWeek > ScheduledRecapMaxDaysOfWeek {
		return 0, NewAppError("ScheduledRecap.ComputeNextRunAt", "model.scheduled_recap.compute_next_run.days_of_week.app_error", nil, "days_of_week="+strconv.Itoa(sr.DaysOfWeek), http.StatusBadRequest)
	}

	// Convert fromTime to user's timezone
	localNow := fromTime.In(loc)

	// Start searching from today
	candidate := time.Date(
		localNow.Year(), localNow.Month(), localNow.Day(),
		hour, minute, 0, 0,
		loc,
	)

	// If today's time has passed, start from tomorrow
	if !candidate.After(localNow) {
		candidate = candidate.AddDate(0, 0, 1)
	}

	// Find next matching day of week (max 7 iterations)
	for i := 0; i < 7; i++ {
		weekday := int(candidate.Weekday()) // 0=Sunday
		dayBit := 1 << weekday

		if sr.DaysOfWeek&dayBit != 0 {
			// Found a matching day - return as UTC milliseconds
			return candidate.UnixMilli(), nil
		}

		candidate = candidate.AddDate(0, 0, 1)
	}

	return 0, NewAppError("ScheduledRecap.ComputeNextRunAt", "model.scheduled_recap.compute_next_run.no_valid_day.app_error", nil, "", http.StatusBadRequest)
}

// IsValid validates the scheduled recap configuration
func (sr *ScheduledRecap) IsValid() *AppError {
	if !IsValidId(sr.Id) {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.id.app_error", nil, "id="+sr.Id, http.StatusBadRequest)
	}

	if !IsValidId(sr.UserId) {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.user_id.app_error", nil, "user_id="+sr.UserId, http.StatusBadRequest)
	}

	if sr.Title == "" {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.title_empty.app_error", nil, "", http.StatusBadRequest)
	}

	if len(sr.Title) > ScheduledRecapTitleMaxLength {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.title_length.app_error", nil, "title_length="+strconv.Itoa(len(sr.Title)), http.StatusBadRequest)
	}

	if sr.DaysOfWeek < ScheduledRecapMinDaysOfWeek || sr.DaysOfWeek > ScheduledRecapMaxDaysOfWeek {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.days_of_week.app_error", nil, "days_of_week="+strconv.Itoa(sr.DaysOfWeek), http.StatusBadRequest)
	}

	if !timeOfDayRegex.MatchString(sr.TimeOfDay) {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.time_of_day.app_error", nil, "time_of_day="+sr.TimeOfDay, http.StatusBadRequest)
	}

	// Validate timezone by attempting to load it
	if _, err := time.LoadLocation(sr.Timezone); err != nil {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.timezone.app_error", nil, "timezone="+sr.Timezone, http.StatusBadRequest)
	}

	if sr.TimePeriod != TimePeriodLast24h && sr.TimePeriod != TimePeriodLastWeek && sr.TimePeriod != TimePeriodSinceLastRead {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.time_period.app_error", nil, "time_period="+sr.TimePeriod, http.StatusBadRequest)
	}

	if sr.ChannelMode != ChannelModeSpecific && sr.ChannelMode != ChannelModeAllUnreads {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.channel_mode.app_error", nil, "channel_mode="+sr.ChannelMode, http.StatusBadRequest)
	}

	if sr.ChannelMode == ChannelModeSpecific && len(sr.ChannelIds) == 0 {
		return NewAppError("ScheduledRecap.IsValid", "model.scheduled_recap.is_valid.channel_ids_empty.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// PreSave prepares the scheduled recap for initial save
func (sr *ScheduledRecap) PreSave() {
	if sr.Id == "" {
		sr.Id = NewId()
	}

	if sr.CreateAt == 0 {
		sr.CreateAt = GetMillis()
	}

	if sr.UpdateAt == 0 {
		sr.UpdateAt = sr.CreateAt
	}
}

// PreUpdate prepares the scheduled recap for update
func (sr *ScheduledRecap) PreUpdate() {
	sr.UpdateAt = GetMillis()
}

// Auditable returns a map of safe-to-log fields for audit logging
func (sr *ScheduledRecap) Auditable() map[string]any {
	return map[string]any{
		"id":           sr.Id,
		"user_id":      sr.UserId,
		"title":        sr.Title,
		"days_of_week": sr.DaysOfWeek,
		"time_of_day":  sr.TimeOfDay,
		"timezone":     sr.Timezone,
		"time_period":  sr.TimePeriod,
		"next_run_at":  sr.NextRunAt,
		"last_run_at":  sr.LastRunAt,
		"run_count":    sr.RunCount,
		"channel_mode": sr.ChannelMode,
		"channel_ids":  sr.ChannelIds,
		"agent_id":     sr.AgentId,
		"is_recurring": sr.IsRecurring,
		"enabled":      sr.Enabled,
		"create_at":    sr.CreateAt,
		"update_at":    sr.UpdateAt,
		"delete_at":    sr.DeleteAt,
	}
}
