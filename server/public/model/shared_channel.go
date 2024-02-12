// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"unicode/utf8"

	"github.com/pkg/errors"
)

var (
	ErrChannelAlreadyShared = errors.New("channel is already shared")
	ErrChannelHomedOnRemote = errors.New("channel is homed on a remote cluster")
)

// SharedChannel represents a channel that can be synchronized with a remote cluster.
// If "home" is true, then the shared channel is homed locally and "SharedChannelRemote"
// table contains the remote clusters that have been invited.
// If "home" is false, then the shared channel is homed remotely, and "RemoteId"
// field points to the remote cluster connection in "RemoteClusters" table.
type SharedChannel struct {
	ChannelId        string      `json:"id"`
	TeamId           string      `json:"team_id"`
	Home             bool        `json:"home"`
	ReadOnly         bool        `json:"readonly"`
	ShareName        string      `json:"name"`
	ShareDisplayName string      `json:"display_name"`
	SharePurpose     string      `json:"purpose"`
	ShareHeader      string      `json:"header"`
	CreatorId        string      `json:"creator_id"`
	CreateAt         int64       `json:"create_at"`
	UpdateAt         int64       `json:"update_at"`
	RemoteId         string      `json:"remote_id,omitempty"` // if not "home"
	Type             ChannelType `db:"-"`
}

func (sc *SharedChannel) IsValid() *AppError {
	if !IsValidId(sc.ChannelId) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.id.app_error", nil, "ChannelId="+sc.ChannelId, http.StatusBadRequest)
	}

	if sc.Type != ChannelTypeDirect && !IsValidId(sc.TeamId) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.id.app_error", nil, "TeamId="+sc.TeamId, http.StatusBadRequest)
	}

	if sc.CreateAt == 0 {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.create_at.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if sc.UpdateAt == 0 {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.update_at.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(sc.ShareDisplayName) > ChannelDisplayNameMaxRunes {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.display_name.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if !IsValidChannelIdentifier(sc.ShareName) {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.1_or_more.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(sc.ShareHeader) > ChannelHeaderMaxRunes {
		return NewAppError("SharedChannel.IsValid", "model.channel.is_valid.header.app_error", nil, "id="+sc.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(sc.SharePurpose) > ChannelPurposeMaxRunes {
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
	CreatorId         string `json:"creator_id"`
	CreateAt          int64  `json:"create_at"`
	UpdateAt          int64  `json:"update_at"`
	IsInviteAccepted  bool   `json:"is_invite_accepted"`
	IsInviteConfirmed bool   `json:"is_invite_confirmed"`
	RemoteId          string `json:"remote_id"`
	LastPostUpdateAt  int64  `json:"last_post_update_at"`
	LastPostUpdateID  string `json:"last_post_id"`
	LastPostCreateAt  int64  `json:"last_post_create_at"`
	LastPostCreateID  string `json:"last_post_create_id"`
}

func (sc *SharedChannelRemote) IsValid() *AppError {
	if !IsValidId(sc.Id) {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.id.app_error", nil, "Id="+sc.Id, http.StatusBadRequest)
	}

	if !IsValidId(sc.ChannelId) {
		return NewAppError("SharedChannelRemote.IsValid", "model.channel.is_valid.id.app_error", nil, "ChannelId="+sc.ChannelId, http.StatusBadRequest)
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

type GetUsersForSyncFilter struct {
	CheckProfileImage bool
	ChannelID         string
	Limit             uint64
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
	MemberId      string
	ExcludeHome   bool
	ExcludeRemote bool
}

type SharedChannelRemoteFilterOpts struct {
	ChannelId       string
	RemoteId        string
	InclUnconfirmed bool
}

// SyncMsg represents a change in content (post add/edit/delete, reaction add/remove, users).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type SyncMsg struct {
	Id        string           `json:"id"`
	ChannelId string           `json:"channel_id"`
	Users     map[string]*User `json:"users,omitempty"`
	Posts     []*Post          `json:"posts,omitempty"`
	Reactions []*Reaction      `json:"reactions,omitempty"`
}

func NewSyncMsg(channelID string) *SyncMsg {
	return &SyncMsg{
		Id:        NewId(),
		ChannelId: channelID,
	}
}

func (sm *SyncMsg) ToJSON() ([]byte, error) {
	b, err := json.Marshal(sm)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (sm *SyncMsg) String() string {
	json, err := sm.ToJSON()
	if err != nil {
		return ""
	}
	return string(json)
}

// SyncResponse represents the response to a synchronization event
type SyncResponse struct {
	UsersLastUpdateAt int64    `json:"users_last_update_at"`
	UserErrors        []string `json:"user_errors"`
	UsersSyncd        []string `json:"users_syncd"`

	PostsLastUpdateAt int64    `json:"posts_last_update_at"`
	PostErrors        []string `json:"post_errors"`

	ReactionsLastUpdateAt int64    `json:"reactions_last_update_at"`
	ReactionErrors        []string `json:"reaction_errors"`
}

// RegisterPluginOpts is passed by plugins to the `RegisterPluginForSharedChannels` plugin API
// to provide options for registering as a shared channels remote.
type RegisterPluginOpts struct {
	Displayname  string // a displayname used in status reports
	PluginID     string // id of this plugin registering
	CreatorID    string // id of the user/bot registering
	AutoShareDMs bool   // when true, all DMs are automatically shared to this remote
	AutoInvited  bool   // when true, the plugin is automatically invited and sync'd with all shared channels.
}

// GetOptionFlags returns a Bitmask of option flags as specified by the boolean options.
func (po RegisterPluginOpts) GetOptionFlags() Bitmask {
	var flags Bitmask
	if po.AutoShareDMs {
		flags |= BitflagOptionAutoShareDMs
	}
	if po.AutoInvited {
		flags |= BitflagOptionAutoInvited
	}
	return flags
}
