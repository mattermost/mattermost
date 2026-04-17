// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

const (
	JoinRequestStatusPending  = "pending"
	JoinRequestStatusApproved = "approved"
	JoinRequestStatusDenied   = "denied"
)

type ChannelJoinRequest struct {
	Id         string `json:"id"`
	ChannelId  string `json:"channel_id"`
	UserId     string `json:"user_id"`
	Status     string `json:"status"`
	CreateAt   int64  `json:"create_at"`
	UpdateAt   int64  `json:"update_at"`
	ReviewedBy string `json:"reviewed_by"`
}

type ChannelJoinRequestList []*ChannelJoinRequest

func (o *ChannelJoinRequest) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.Status != JoinRequestStatusPending && o.Status != JoinRequestStatusApproved && o.Status != JoinRequestStatusDenied {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.status.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("ChannelJoinRequest.IsValid", "model.channel_join_request.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *ChannelJoinRequest) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.Status == "" {
		o.Status = JoinRequestStatusPending
	}

	now := GetMillis()
	if o.CreateAt == 0 {
		o.CreateAt = now
	}
	o.UpdateAt = now
}

func (o *ChannelJoinRequest) PreUpdate() {
	o.UpdateAt = GetMillis()
}
