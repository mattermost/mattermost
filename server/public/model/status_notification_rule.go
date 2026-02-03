// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
)

// StatusNotificationRule defines a rule for sending push notifications
// when a watched user's status changes or activity is updated.
type StatusNotificationRule struct {
	Id              string `json:"id" db:"id"`
	Name            string `json:"name" db:"name"`
	Enabled         bool   `json:"enabled" db:"enabled"`
	WatchedUserID   string `json:"watched_user_id" db:"watcheduserid"`
	RecipientUserID string `json:"recipient_user_id" db:"recipientuserid"`
	EventFilters    string `json:"event_filters" db:"eventfilters"` // Comma-separated: "status_online,activity_message"
	CreateAt        int64  `json:"create_at" db:"createat"`
	UpdateAt        int64  `json:"update_at" db:"updateat"`
	DeleteAt        int64  `json:"delete_at" db:"deleteat"`
	CreatedBy       string `json:"created_by" db:"createdby"`
}

// Event filter constants for StatusNotificationRule
const (
	// Status change filters
	StatusNotificationFilterStatusOnline  = "status_online"
	StatusNotificationFilterStatusAway    = "status_away"
	StatusNotificationFilterStatusDND     = "status_dnd"
	StatusNotificationFilterStatusOffline = "status_offline"
	StatusNotificationFilterStatusAny     = "status_any"

	// Activity filters
	StatusNotificationFilterActivityMessage     = "activity_message"
	StatusNotificationFilterActivityChannelView = "activity_channel_view"
	StatusNotificationFilterActivityWindowFocus = "activity_window_focus"
	StatusNotificationFilterActivityAny         = "activity_any"

	// Catch-all
	StatusNotificationFilterAll = "all"
)

// ValidEventFilters is the list of all valid event filter values
var ValidEventFilters = []string{
	StatusNotificationFilterStatusOnline,
	StatusNotificationFilterStatusAway,
	StatusNotificationFilterStatusDND,
	StatusNotificationFilterStatusOffline,
	StatusNotificationFilterStatusAny,
	StatusNotificationFilterActivityMessage,
	StatusNotificationFilterActivityChannelView,
	StatusNotificationFilterActivityWindowFocus,
	StatusNotificationFilterActivityAny,
	StatusNotificationFilterAll,
}

// IsValid validates the StatusNotificationRule
func (r *StatusNotificationRule) IsValid() *AppError {
	if !IsValidId(r.Id) {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if r.Name == "" || len(r.Name) > 128 {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.name.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(r.WatchedUserID) {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.watched_user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(r.RecipientUserID) {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.recipient_user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(r.CreatedBy) {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.created_by.app_error", nil, "", http.StatusBadRequest)
	}

	if r.CreateAt == 0 {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if r.UpdateAt == 0 {
		return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate event filters
	if r.EventFilters != "" {
		filters := r.GetEventFilters()
		for _, filter := range filters {
			if !isValidEventFilter(filter) {
				return NewAppError("StatusNotificationRule.IsValid", "model.status_notification_rule.is_valid.event_filters.app_error", map[string]any{"Filter": filter}, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

// PreSave prepares the rule before saving for the first time
func (r *StatusNotificationRule) PreSave() {
	if r.Id == "" {
		r.Id = NewId()
	}

	r.CreateAt = GetMillis()
	r.UpdateAt = r.CreateAt
	r.DeleteAt = 0
	r.Enabled = true

	// Normalize event filters
	r.EventFilters = strings.TrimSpace(r.EventFilters)
}

// PreUpdate prepares the rule before updating
func (r *StatusNotificationRule) PreUpdate() {
	r.UpdateAt = GetMillis()

	// Normalize event filters
	r.EventFilters = strings.TrimSpace(r.EventFilters)
}

// GetEventFilters returns the event filters as a slice of strings
func (r *StatusNotificationRule) GetEventFilters() []string {
	if r.EventFilters == "" {
		return []string{}
	}

	filters := strings.Split(r.EventFilters, ",")
	result := make([]string, 0, len(filters))
	for _, f := range filters {
		trimmed := strings.TrimSpace(f)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// SetEventFilters sets the event filters from a slice of strings
func (r *StatusNotificationRule) SetEventFilters(filters []string) {
	r.EventFilters = strings.Join(filters, ",")
}

// MatchesLog checks if the given StatusLog matches any of the rule's event filters
func (r *StatusNotificationRule) MatchesLog(log *StatusLog) bool {
	filters := r.GetEventFilters()
	if len(filters) == 0 {
		// No filters means match nothing (user must select at least one)
		return false
	}

	for _, filter := range filters {
		if matchesFilter(filter, log) {
			return true
		}
	}

	return false
}

// matchesFilter checks if a single filter matches the log
func matchesFilter(filter string, log *StatusLog) bool {
	switch filter {
	case StatusNotificationFilterAll:
		return true

	// Status change filters
	case StatusNotificationFilterStatusAny:
		return log.LogType == StatusLogTypeStatusChange

	case StatusNotificationFilterStatusOnline:
		return log.LogType == StatusLogTypeStatusChange && log.NewStatus == StatusOnline

	case StatusNotificationFilterStatusAway:
		return log.LogType == StatusLogTypeStatusChange && log.NewStatus == StatusAway

	case StatusNotificationFilterStatusDND:
		return log.LogType == StatusLogTypeStatusChange && log.NewStatus == StatusDnd

	case StatusNotificationFilterStatusOffline:
		return log.LogType == StatusLogTypeStatusChange && log.NewStatus == StatusOffline

	// Activity filters
	case StatusNotificationFilterActivityAny:
		return log.LogType == StatusLogTypeActivity

	case StatusNotificationFilterActivityMessage:
		return log.LogType == StatusLogTypeActivity && strings.Contains(log.Trigger, "Sent message")

	case StatusNotificationFilterActivityChannelView:
		return log.LogType == StatusLogTypeActivity && strings.Contains(log.Trigger, "Loaded ")

	case StatusNotificationFilterActivityWindowFocus:
		return log.LogType == StatusLogTypeActivity && log.Reason == StatusLogReasonWindowFocus

	default:
		return false
	}
}

// isValidEventFilter checks if the filter string is a valid event filter
func isValidEventFilter(filter string) bool {
	for _, valid := range ValidEventFilters {
		if filter == valid {
			return true
		}
	}
	return false
}

// StatusNotificationRuleList is a list of StatusNotificationRule
type StatusNotificationRuleList []*StatusNotificationRule
