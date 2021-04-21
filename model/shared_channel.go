// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"unicode/utf8"
)

// SharedChannel represents a channel that can be synchronized with a remote cluster.
// If "home" is true, then the shared channel is homed locally and "SharedChannelRemote"
// table contains the remote clusters that have been invited.
// If "home" is false, then the shared channel is homed remotely, and "RemoteId"
// field points to the remote cluster connection in "RemoteClusters" table.
type SharedChannel struct {
	ChannelId        string `json:"channel_id"`
	TeamId           string `json:"team_id"`
	Home             bool   `json:"home"`
	ReadOnly         bool   `json:"readonly"`
	ShareName        string `json:"share_name"`
	ShareDisplayName string `json:"share_displayname"`
	SharePurpose     string `json:"share_purpose"`
	ShareHeader      string `json:"share_header"`
	CreatorId        string `json:"creator_id"`
	CreateAt         int64  `json:"create_at"`
	UpdateAt         int64  `json:"update_at"`
	RemoteId         string `json:"remote_id,omitempty"` // if not "home"
	Type             string `db:"-"`
}

func (sc *SharedChannel) ToJson() string {
	b, _ := json.Marshal(sc)
	return string(b)
}

func SharedChannelFromJson(data io.Reader) (*SharedChannel, error) {
	var sc *SharedChannel
	err := json.NewDecoder(data).Decode(&sc)
	return sc, err
}

func (sc *SharedChannel) IsValid() *AppError {
	if !IsValidId(sc.ChannelId) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.id.app_error", nil, "ChannelId="+sc.ChannelId, http.StatusBadRequest)
	}

	if sc.Type != CHANNEL_DIRECT && !IsValidId(sc.TeamId) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.id.app_error", nil, "TeamId="+sc.TeamId, http.StatusBadRequest)
	}

	if sc.CreateAt == 0 {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.create_at.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if sc.UpdateAt == 0 {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.update_at.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(sc.ShareDisplayName) > CHANNEL_DISPLAY_NAME_MAX_RUNES {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.display_name.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if !IsValidChannelIdentifier(sc.ShareName) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.2_or_more.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(sc.ShareHeader) > CHANNEL_HEADER_MAX_RUNES {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.header.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(sc.SharePurpose) > CHANNEL_PURPOSE_MAX_RUNES {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.purpose.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if !IsValidId(sc.CreatorId) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.creator_id.app_error", nil, "CreatorId="+sc.CreatorId, http.StatusBadRequest)
	}

	if !sc.Home {
		if !IsValidId(sc.RemoteId) {
			return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.id.app_error", nil, "RemoteId="+sc.RemoteId, http.StatusBadRequest)
		}
	}
	return nil
}

func (sc *SharedChannel) PreSave() {
	sc.ShareName = SanitizeUnicode(sc.ShareName)
	sc.ShareDisplayName = SanitizeUnicode(sc.ShareDisplayName)

	sc.CreateAt = GetMillis()
	sc.UpdateAt = sc.CreateAt
}

func (sc *SharedChannel) PreUpdate() {
	sc.UpdateAt = GetMillis()
	sc.ShareName = SanitizeUnicode(sc.ShareName)
	sc.ShareDisplayName = SanitizeUnicode(sc.ShareDisplayName)
}

// SharedChannelRemote represents a remote cluster that has been invited
// to a shared channel.
type SharedChannelRemote struct {
	Id                string `json:"id"`
	ChannelId         string `json:"channel_id"`
	Description       string `json:"description"`
	CreatorId         string `json:"creator_id"`
	CreateAt          int64  `json:"create_at"`
	UpdateAt          int64  `json:"update_at"`
	IsInviteAccepted  bool   `json:"is_invite_accepted"`
	IsInviteConfirmed bool   `json:"is_invite_confirmed"`
	RemoteId          string `json:"remote_id"`
	NextSyncAt        int64  `json:"next_sync_at"`
}

func (sc *SharedChannelRemote) ToJson() string {
	b, _ := json.Marshal(sc)
	return string(b)
}

func SharedChannelRemoteFromJson(data io.Reader) (*SharedChannelRemote, error) {
	var sc *SharedChannelRemote
	err := json.NewDecoder(data).Decode(&sc)
	return sc, err
}

func (sc *SharedChannelRemote) IsValid() *AppError {
	if !IsValidId(sc.Id) {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.id.app_error", nil, "Id="+sc.Id, http.StatusBadRequest)
	}

	if !IsValidId(sc.ChannelId) {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.id.app_error", nil, "ChannelId="+sc.ChannelId, http.StatusBadRequest)
	}

	if len(sc.Description) > 64 {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.description.app_error", nil, "description="+sc.Description, http.StatusBadRequest)
	}

	if sc.CreateAt == 0 {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.create_at.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if sc.UpdateAt == 0 {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.update_at.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if !IsValidId(sc.CreatorId) {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.creator_id.app_error", nil, "id="+sc.CreatorId, http.StatusBadRequest)
	}
	return nil
}

func (sc *SharedChannelRemote) PreSave() {
	if sc.Id == "" {
		sc.Id = NewId()
	}
	sc.CreateAt = GetMillis()
	sc.UpdateAt = sc.CreateAt
}

func (sc *SharedChannelRemote) PreUpdate() {
	sc.UpdateAt = GetMillis()
}

type SharedChannelRemoteStatus struct {
	ChannelId        string `json:"channel_id"`
	DisplayName      string `json:"display_name"`
	SiteURL          string `json:"site_url"`
	LastPingAt       int64  `json:"last_ping_at"`
	NextSyncAt       int64  `json:"next_sync_at"`
	Description      string `json:"description"`
	ReadOnly         bool   `json:"readonly"`
	IsInviteAccepted bool   `json:"is_invite_accepted"`
	Token            string `json:"token"`
}

// SharedChannelUser stores a lastSyncAt timestamp on behalf of a remote cluster for
// each user that has been synchronized.
type SharedChannelUser struct {
	Id         string `json:"id"`
	UserId     string `json:"user_id"`
	ChannelId  string `json:"channel_id"`
	RemoteId   string `json:"remote_id"`
	CreateAt   int64  `json:"create_at"`
	LastSyncAt int64  `json:"last_sync_at"`
}

func (scu *SharedChannelUser) PreSave() {
	scu.Id = NewId()
	scu.CreateAt = GetMillis()
}

func (scu *SharedChannelUser) IsValid() *AppError {
	if !IsValidId(scu.Id) {
		return NewAppError("SharedChannelUser.IsValid", "model.channel.is_valid.id.app_error", nil, "Id="+scu.Id, http.StatusBadRequest)
	}

	if !IsValidId(scu.UserId) {
		return NewAppError("SharedChannelUser.IsValid", "model.channel.is_valid.id.app_error", nil, "UserId="+scu.UserId, http.StatusBadRequest)
	}

	if !IsValidId(scu.ChannelId) {
		return NewAppError("SharedChannelUser.IsValid", "model.channel.is_valid.id.app_error", nil, "ChannelId="+scu.ChannelId, http.StatusBadRequest)
	}

	if !IsValidId(scu.RemoteId) {
		return NewAppError("SharedChannelUser.IsValid", "model.channel.is_valid.id.app_error", nil, "RemoteId="+scu.RemoteId, http.StatusBadRequest)
	}

	if scu.CreateAt == 0 {
		return NewAppError("SharedChannelUser.IsValid", "model.channel.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// SharedChannelAttachment stores a lastSyncAt timestamp on behalf of a remote cluster for
// each file attachment that has been synchronized.
type SharedChannelAttachment struct {
	Id         string `json:"id"`
	FileId     string `json:"file_id"`
	RemoteId   string `json:"remote_id"`
	CreateAt   int64  `json:"create_at"`
	LastSyncAt int64  `json:"last_sync_at"`
}

func (scf *SharedChannelAttachment) PreSave() {
	if scf.Id == "" {
		scf.Id = NewId()
	}
	if scf.CreateAt == 0 {
		scf.CreateAt = GetMillis()
		scf.LastSyncAt = scf.CreateAt
	} else {
		scf.LastSyncAt = GetMillis()
	}
}

func (scf *SharedChannelAttachment) IsValid() *AppError {
	if !IsValidId(scf.Id) {
		return NewAppError("SharedChannelAttachment.IsValid", "model.channel.is_valid.id.app_error", nil, "Id="+scf.Id, http.StatusBadRequest)
	}

	if !IsValidId(scf.FileId) {
		return NewAppError("SharedChannelAttachment.IsValid", "model.channel.is_valid.id.app_error", nil, "FileId="+scf.FileId, http.StatusBadRequest)
	}

	if !IsValidId(scf.RemoteId) {
		return NewAppError("SharedChannelAttachment.IsValid", "model.channel.is_valid.id.app_error", nil, "RemoteId="+scf.RemoteId, http.StatusBadRequest)
	}

	if scf.CreateAt == 0 {
		return NewAppError("SharedChannelAttachment.IsValid", "model.channel.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

type SharedChannelFilterOpts struct {
	TeamId        string
	CreatorId     string
	ExcludeHome   bool
	ExcludeRemote bool
}

type SharedChannelRemoteFilterOpts struct {
	ChannelId       string
	RemoteId        string
	InclUnconfirmed bool
}
