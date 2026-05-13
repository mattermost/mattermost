// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"encoding/xml"
	"net/http"
	"sort"
	"unicode/utf8"

	"github.com/pkg/errors"
)

const (
	UserPropsKeyRemoteUsername   = "RemoteUsername"
	UserPropsKeyRemoteEmail      = "RemoteEmail"
	UserPropsKeyOriginalRemoteId = "OriginalRemoteId"
	UserOriginalRemoteIdUnknown  = "UNKNOWN"
)

var (
	ErrChannelAlreadyShared = errors.New("channel is already shared")
	ErrChannelHomedOnRemote = errors.New("channel is homed on a remote cluster")
	ErrChannelAlreadyExists = errors.New("channel already exists")
	ErrChannelNotShared     = errors.New("channel is not shared")
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

	if sc.Type != ChannelTypeDirect && sc.Type != ChannelTypeGroup && !IsValidId(sc.TeamId) {
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
	DeleteAt          int64  `json:"delete_at"`
	IsInviteAccepted  bool   `json:"is_invite_accepted"`
	IsInviteConfirmed bool   `json:"is_invite_confirmed"`
	RemoteId          string `json:"remote_id"`
	LastPostUpdateAt  int64  `json:"last_post_update_at"`
	LastPostUpdateID  string `json:"last_post_id"`
	LastPostCreateAt  int64  `json:"last_post_create_at"`
	LastPostCreateID  string `json:"last_post_create_id"`
	LastMembersSyncAt int64  `json:"last_members_sync_at"`
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
	RemoteId         string `json:"remote_id"`
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
	ChannelId          string
	RemoteId           string
	IncludeUnconfirmed bool
	ExcludeConfirmed   bool
	ExcludeHome        bool
	ExcludeRemote      bool
	IncludeDeleted     bool
}

// MembershipChangeMsg represents a change in channel membership
type MembershipChangeMsg struct {
	ChannelId  string `json:"channel_id" xml:"ChannelId"`
	UserId     string `json:"user_id" xml:"UserId"`
	IsAdd      bool   `json:"is_add" xml:"IsAdd"`
	RemoteId   string `json:"remote_id" xml:"RemoteId"`
	ChangeTime int64  `json:"change_time" xml:"ChangeTime"`
}

// SyncMsg represents a change in content (post add/edit/delete, reaction add/remove, users).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type SyncMsg struct {
	Id                string                 `json:"id"`
	ChannelId         string                 `json:"channel_id"`
	Users             map[string]*User       `json:"users,omitempty"`
	Posts             []*Post                `json:"posts,omitempty"`
	Reactions         []*Reaction            `json:"reactions,omitempty"`
	Statuses          []*Status              `json:"statuses,omitempty"`
	MembershipChanges []*MembershipChangeMsg `json:"membership_changes,omitempty"`
	Acknowledgements  []*PostAcknowledgement `json:"acknowledgements,omitempty"`
	MentionTransforms map[string]string      `json:"mention_transforms,omitempty"`
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

// xmlSyncMsgFields contains the non-map fields of SyncMsg for XML serialization.
type xmlSyncMsgFields struct {
	Id                string                 `xml:"Id"`
	ChannelId         string                 `xml:"ChannelId"`
	Posts             []*Post                `xml:"Posts>Post,omitempty"`
	Reactions         []*Reaction            `xml:"Reactions>Reaction,omitempty"`
	Statuses          []*Status              `xml:"Statuses>Status,omitempty"`
	MembershipChanges []*MembershipChangeMsg `xml:"MembershipChanges>MembershipChangeMsg,omitempty"`
	Acknowledgements  []*PostAcknowledgement `xml:"Acknowledgements>PostAcknowledgement,omitempty"`
}

// xmlSyncMsgUser wraps a User with an ID attribute for XML map serialization.
type xmlSyncMsgUser struct {
	ID   string `xml:"id,attr"`
	User *User  `xml:"User"`
}

// xmlSyncMsgMentionTransform represents a single mention transform entry.
type xmlSyncMsgMentionTransform struct {
	Key   string `xml:"key,attr"`
	Value string `xml:"value,attr"`
}

// MarshalXML encodes a SyncMsg to XML, handling the Users map and MentionTransforms map.
func (sm *SyncMsg) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	if err := e.EncodeToken(start); err != nil {
		return err
	}

	// Encode non-map fields via the helper struct.
	fields := xmlSyncMsgFields{
		Id:                sm.Id,
		ChannelId:         sm.ChannelId,
		Posts:             sm.Posts,
		Reactions:         sm.Reactions,
		Statuses:          sm.Statuses,
		MembershipChanges: sm.MembershipChanges,
		Acknowledgements:  sm.Acknowledgements,
	}
	if err := e.EncodeElement(fields, xml.StartElement{Name: xml.Name{Local: "Fields"}}); err != nil {
		return err
	}

	// Encode Users map as <Users><UserEntry id="..."><User>...</User></UserEntry></Users>
	if len(sm.Users) > 0 {
		usersStart := xml.StartElement{Name: xml.Name{Local: "Users"}}
		if err := e.EncodeToken(usersStart); err != nil {
			return err
		}

		keys := make([]string, 0, len(sm.Users))
		for k := range sm.Users {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			entry := xmlSyncMsgUser{ID: k, User: sm.Users[k]}
			if err := e.EncodeElement(entry, xml.StartElement{Name: xml.Name{Local: "UserEntry"}}); err != nil {
				return err
			}
		}

		if err := e.EncodeToken(usersStart.End()); err != nil {
			return err
		}
	}

	// Encode MentionTransforms as <MentionTransforms><Transform key="..." value="..."/></MentionTransforms>
	if len(sm.MentionTransforms) > 0 {
		mtStart := xml.StartElement{Name: xml.Name{Local: "MentionTransforms"}}
		if err := e.EncodeToken(mtStart); err != nil {
			return err
		}

		keys := make([]string, 0, len(sm.MentionTransforms))
		for k := range sm.MentionTransforms {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			entry := xmlSyncMsgMentionTransform{Key: k, Value: sm.MentionTransforms[k]}
			if err := e.EncodeElement(entry, xml.StartElement{Name: xml.Name{Local: "Transform"}}); err != nil {
				return err
			}
		}

		if err := e.EncodeToken(mtStart.End()); err != nil {
			return err
		}
	}

	return e.EncodeToken(start.End())
}

// UnmarshalXML decodes a SyncMsg from XML, handling the Users map and MentionTransforms map.
func (sm *SyncMsg) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	sm.Users = nil
	sm.MentionTransforms = nil

	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}

		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "Fields":
				var fields xmlSyncMsgFields
				if err := d.DecodeElement(&fields, &t); err != nil {
					return err
				}
				sm.Id = fields.Id
				sm.ChannelId = fields.ChannelId
				sm.Posts = fields.Posts
				sm.Reactions = fields.Reactions
				sm.Statuses = fields.Statuses
				sm.MembershipChanges = fields.MembershipChanges
				sm.Acknowledgements = fields.Acknowledgements

			case "Users":
				sm.Users = make(map[string]*User)
				if err := decodeXMLUsers(d, sm); err != nil {
					return err
				}

			case "MentionTransforms":
				sm.MentionTransforms = make(map[string]string)
				if err := decodeXMLMentionTransforms(d, sm); err != nil {
					return err
				}

			default:
				if err := d.Skip(); err != nil {
					return err
				}
			}

		case xml.EndElement:
			return nil
		}
	}
}

func decodeXMLUsers(d *xml.Decoder, sm *SyncMsg) error {
	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}

		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "UserEntry" {
				var entry xmlSyncMsgUser
				if err := d.DecodeElement(&entry, &t); err != nil {
					return err
				}
				sm.Users[entry.ID] = entry.User
			} else {
				if err := d.Skip(); err != nil {
					return err
				}
			}
		case xml.EndElement:
			return nil
		}
	}
}

func decodeXMLMentionTransforms(d *xml.Decoder, sm *SyncMsg) error {
	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}

		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "Transform" {
				var entry xmlSyncMsgMentionTransform
				if err := d.DecodeElement(&entry, &t); err != nil {
					return err
				}
				sm.MentionTransforms[entry.Key] = entry.Value
			} else {
				if err := d.Skip(); err != nil {
					return err
				}
			}
		case xml.EndElement:
			return nil
		}
	}
}

// SyncResponse represents the response to a synchronization event
type SyncResponse struct {
	UsersLastUpdateAt int64    `json:"users_last_update_at" xml:"UsersLastUpdateAt"`
	UserErrors        []string `json:"user_errors" xml:"UserErrors>Error"`
	UsersSyncd        []string `json:"users_syncd" xml:"UsersSyncd>UserId"`

	PostsLastUpdateAt int64    `json:"posts_last_update_at" xml:"PostsLastUpdateAt"`
	PostErrors        []string `json:"post_errors" xml:"PostErrors>Error"`

	ReactionsLastUpdateAt int64    `json:"reactions_last_update_at" xml:"ReactionsLastUpdateAt"`
	ReactionErrors        []string `json:"reaction_errors" xml:"ReactionErrors>Error"`

	AcknowledgementsLastUpdateAt int64    `json:"acknowledgements_last_update_at" xml:"AcknowledgementsLastUpdateAt"`
	AcknowledgementErrors        []string `json:"acknowledgement_errors" xml:"AcknowledgementErrors>Error"`

	StatusErrors []string `json:"status_errors" xml:"StatusErrors>Error"` // user IDs for which the status sync failed

	MembershipErrors []string `json:"membership_errors,omitempty" xml:"MembershipErrors>Error,omitempty"`
}

// RegisterPluginOpts is passed by plugins to the `RegisterPluginForSharedChannels` plugin API
// to provide options for registering as a shared channels remote.
type RegisterPluginOpts struct {
	Displayname  string // a displayname used in status reports
	PluginID     string // id of this plugin registering
	CreatorID    string // id of the user/bot registering
	AutoShareDMs bool   // when true, all DMs are automatically shared to this remote
	AutoInvited  bool   // when true, the plugin is automatically invited and sync'd with all shared channels.

	// SiteURL identifies the remote endpoint for this secure connection. Stored directly as
	// RemoteCluster.SiteURL. Must be unique across all remote clusters (enforced by the DB
	// unique index on (SiteURL, RemoteTeamId)).
	// When empty, defaults to "plugin_<PluginID>" for backward compatibility with single-remote
	// plugins. When non-empty, the SiteURL must not already be in use by a different plugin or
	// a server-to-server remote.
	// Calling RegisterPluginForSharedChannels again with the same SiteURL returns the existing
	// remoteID and preserves sync cursors (idempotent re-registration).
	// A plugin registers multiple remotes by calling this method multiple times with different
	// SiteURLs.
	// Examples: "nats://nats:4222", "https://matrix.org"
	SiteURL string
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
