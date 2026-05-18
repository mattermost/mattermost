// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"unicode/utf8"
)

const (
	ChannelJoinRequestStatusPending   = "pending"
	ChannelJoinRequestStatusApproved  = "approved"
	ChannelJoinRequestStatusDenied    = "denied"
	ChannelJoinRequestStatusWithdrawn = "withdrawn"

	ChannelJoinRequestMessageMaxRunes      = 500
	ChannelJoinRequestDenialReasonMaxRunes = 500
)

// ChannelJoinRequest records a user's request to join a discoverable private channel.
//
// Rows are append-only / status-mutating: a request transitions through
// pending → approved | denied | withdrawn. Rows are never deleted so the full
// audit history is preserved. A partial unique index in Postgres enforces at
// most one active pending row per (ChannelId, UserId).
type ChannelJoinRequest struct {
	Id           string `json:"id"`
	ChannelId    string `json:"channel_id"`
	UserId       string `json:"user_id"`
	Message      string `json:"message"`
	Status       string `json:"status"`
	DenialReason string `json:"denial_reason"`
	CreateAt     int64  `json:"create_at"`
	UpdateAt     int64  `json:"update_at"`
	ReviewedBy   string `json:"reviewed_by"`
	ReviewedAt   int64  `json:"reviewed_at"`
}

// ChannelJoinRequestList is the paginated response shape returned by list endpoints.
type ChannelJoinRequestList struct {
	Requests   []*ChannelJoinRequest `json:"requests"`
	TotalCount int64                 `json:"total_count"`
}

// ChannelJoinRequestPatch represents the admin review action: approve or deny,
// with an optional denial reason that is surfaced to the requester.
type ChannelJoinRequestPatch struct {
	Status       string  `json:"status"`
	DenialReason *string `json:"denial_reason,omitempty"`
}

// GetChannelJoinRequestsOpts filters and paginates list queries on the store.
// An empty Status means "pending".
type GetChannelJoinRequestsOpts struct {
	Status  string
	Page    int
	PerPage int
}

// IsValidChannelJoinRequestStatus reports whether the given status string is a
// recognized lifecycle value for a ChannelJoinRequest.
func IsValidChannelJoinRequestStatus(s string) bool {
	switch s {
	case ChannelJoinRequestStatusPending,
		ChannelJoinRequestStatusApproved,
		ChannelJoinRequestStatusDenied,
		ChannelJoinRequestStatusWithdrawn:
		return true
	}
	return false
}

func (r *ChannelJoinRequest) Auditable() map[string]any {
	return map[string]any{
		"id":                r.Id,
		"channel_id":        r.ChannelId,
		"user_id":           r.UserId,
		"status":            r.Status,
		"create_at":         r.CreateAt,
		"update_at":         r.UpdateAt,
		"reviewed_by":       r.ReviewedBy,
		"reviewed_at":       r.ReviewedAt,
		"has_message":       r.Message != "",
		"has_denial_reason": r.DenialReason != "",
	}
}

func (r *ChannelJoinRequest) LogClone() any {
	return r.Auditable()
}

func (r *ChannelJoinRequest) IsValid() *AppError {
	if !IsValidId(r.Id) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(r.ChannelId) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.channel_id.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if !IsValidId(r.UserId) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.user_id.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if r.CreateAt == 0 {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.create_at.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if r.UpdateAt == 0 {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.update_at.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if !IsValidChannelJoinRequestStatus(r.Status) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.status.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(r.Message) > ChannelJoinRequestMessageMaxRunes {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.message.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(r.DenialReason) > ChannelJoinRequestDenialReasonMaxRunes {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.denial_reason.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	// A denial reason is only meaningful on a denied request.
	if r.DenialReason != "" && r.Status != ChannelJoinRequestStatusDenied {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.denial_reason_status.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	if r.ReviewedBy != "" && !IsValidId(r.ReviewedBy) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.reviewed_by.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}

	// Reviewer and reviewed-at must accompany a terminal review action.
	switch r.Status {
	case ChannelJoinRequestStatusApproved, ChannelJoinRequestStatusDenied:
		if r.ReviewedBy == "" || r.ReviewedAt == 0 {
			return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.reviewer.app_error", nil, "id="+r.Id, http.StatusBadRequest)
		}
	}

	return nil
}

func (r *ChannelJoinRequest) PreSave() {
	if r.Id == "" {
		r.Id = NewId()
	}
	if r.Status == "" {
		r.Status = ChannelJoinRequestStatusPending
	}
	if r.CreateAt == 0 {
		r.CreateAt = GetMillis()
	}
	r.UpdateAt = r.CreateAt
	r.Message = SanitizeUnicode(r.Message)
	r.DenialReason = SanitizeUnicode(r.DenialReason)
}

func (r *ChannelJoinRequest) PreUpdate() {
	r.UpdateAt = GetMillis()
	r.Message = SanitizeUnicode(r.Message)
	r.DenialReason = SanitizeUnicode(r.DenialReason)
}
