// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"unicode/utf8"
)

const (
	SharedChannelInvitationDirectionSent     = "sent"
	SharedChannelInvitationDirectionReceived = "received"

	SharedChannelInvitationStatusPending  = "pending"
	SharedChannelInvitationStatusRejected = "rejected"
	SharedChannelInvitationStatusFailed   = "failed"

	SharedChannelInvitationErrMsgMaxRunes = 255
)

// SharedChannelInvitation records a channel-share invitation on this server (outgoing or incoming).
// Rows are removed once an outgoing invite is fully confirmed (SharedChannelRemote is authoritative)
// or once an incoming invite is processed successfully. Failed or rejected invites are retained for the UI.
type SharedChannelInvitation struct {
	Id        string `json:"id"`
	ChannelId string `json:"channel_id"`
	RemoteId  string `json:"remote_id"`
	Direction string `json:"direction"`
	Status    string `json:"status"`
	ErrMsg    string `json:"error,omitempty"`
	CreatorId string `json:"creator_id"`
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
}

func (i *SharedChannelInvitation) IsValid() *AppError {
	if !IsValidId(i.Id) {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.id.app_error", nil, "Id="+i.Id, http.StatusBadRequest)
	}

	if !IsValidId(i.ChannelId) {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.channel_id.app_error", nil, "ChannelId="+i.ChannelId, http.StatusBadRequest)
	}

	if !IsValidId(i.RemoteId) {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.remote_id.app_error", nil, "RemoteId="+i.RemoteId, http.StatusBadRequest)
	}

	if i.Direction != SharedChannelInvitationDirectionSent && i.Direction != SharedChannelInvitationDirectionReceived {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.direction.app_error", nil, "Direction="+i.Direction, http.StatusBadRequest)
	}

	if i.Status != SharedChannelInvitationStatusPending &&
		i.Status != SharedChannelInvitationStatusRejected &&
		i.Status != SharedChannelInvitationStatusFailed {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.status.app_error", nil, "Status="+i.Status, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(i.ErrMsg) > SharedChannelInvitationErrMsgMaxRunes {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.err_msg.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(i.CreatorId) {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.creator_id.app_error", nil, "CreatorId="+i.CreatorId, http.StatusBadRequest)
	}

	if i.CreateAt == 0 {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if i.UpdateAt == 0 {
		return NewAppError("SharedChannelInvitation.IsValid", "model.shared_channel_invitation.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (i *SharedChannelInvitation) PreSave() {
	if i.Id == "" {
		i.Id = NewId()
	}
	now := GetMillis()
	i.CreateAt = now
	i.UpdateAt = now

	if i.Status == "" {
		i.Status = SharedChannelInvitationStatusPending
	}
}

func (i *SharedChannelInvitation) PreUpdate() {
	i.UpdateAt = GetMillis()
}

// SharedChannelInvitationFilterOpts filters results from SharedChannelInvitationStore.GetAll.
type SharedChannelInvitationFilterOpts struct {
	ChannelId string
	RemoteId  string
	Direction string
	Status    string
}
