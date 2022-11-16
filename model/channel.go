// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

type ChannelType string

const (
	ChannelTypeOpen    ChannelType = "O"
	ChannelTypePrivate ChannelType = "P"
	ChannelTypeDirect  ChannelType = "D"
	ChannelTypeGroup   ChannelType = "G"

	ChannelGroupMaxUsers       = 8
	ChannelGroupMinUsers       = 3
	DefaultChannelName         = "town-square"
	ChannelDisplayNameMaxRunes = 64
	ChannelNameMinLength       = 1
	ChannelNameMaxLength       = 64
	ChannelHeaderMaxRunes      = 1024
	ChannelPurposeMaxRunes     = 250
	ChannelCacheSize           = 25000

	ChannelSortByUsername = "username"
	ChannelSortByStatus   = "status"
)

type Channel struct {
	Id                string         `json:"id"`
	CreateAt          int64          `json:"create_at"`
	UpdateAt          int64          `json:"update_at"`
	DeleteAt          int64          `json:"delete_at"`
	TeamId            string         `json:"team_id"`
	Type              ChannelType    `json:"type"`
	DisplayName       string         `json:"display_name"`
	Name              string         `json:"name"`
	Header            string         `json:"header"`
	Purpose           string         `json:"purpose"`
	LastPostAt        int64          `json:"last_post_at"`
	TotalMsgCount     int64          `json:"total_msg_count"`
	ExtraUpdateAt     int64          `json:"extra_update_at"`
	CreatorId         string         `json:"creator_id"`
	SchemeId          *string        `json:"scheme_id"`
	Props             map[string]any `json:"props"`
	GroupConstrained  *bool          `json:"group_constrained"`
	Shared            *bool          `json:"shared"`
	TotalMsgCountRoot int64          `json:"total_msg_count_root"`
	PolicyID          *string        `json:"policy_id"`
	LastRootPostAt    int64          `json:"last_root_post_at"`
}

func (o *Channel) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"create_at":            o.CreateAt,
		"creator_id":           o.CreatorId,
		"delete_at":            o.DeleteAt,
		"extra_group_at":       o.ExtraUpdateAt,
		"group_constrained":    o.GroupConstrained,
		"id":                   o.Id,
		"last_post_at":         o.LastPostAt,
		"last_root_post_at":    o.LastRootPostAt,
		"policy_id":            o.PolicyID,
		"props":                o.Props,
		"scheme_id":            o.SchemeId,
		"shared":               o.Shared,
		"team_id":              o.TeamId,
		"total_msg_count_root": o.TotalMsgCountRoot,
		"type":                 o.Type,
		"update_at":            o.UpdateAt,
	}
}

type ChannelWithTeamData struct {
	Channel
	TeamDisplayName string `json:"team_display_name"`
	TeamName        string `json:"team_name"`
	TeamUpdateAt    int64  `json:"team_update_at"`
}

type ChannelsWithCount struct {
	Channels   ChannelListWithTeamData `json:"channels"`
	TotalCount int64                   `json:"total_count"`
}

type ChannelPatch struct {
	DisplayName      *string `json:"display_name"`
	Name             *string `json:"name"`
	Header           *string `json:"header"`
	Purpose          *string `json:"purpose"`
	GroupConstrained *bool   `json:"group_constrained"`
}

func (c *ChannelPatch) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"header":            c.Header,
		"group_constrained": c.GroupConstrained,
		"purpose":           c.Purpose,
	}
}

type ChannelForExport struct {
	Channel
	TeamName   string
	SchemeName *string
}

type DirectChannelForExport struct {
	Channel
	Members *[]string
}

type ChannelModeration struct {
	Name  string                 `json:"name"`
	Roles *ChannelModeratedRoles `json:"roles"`
}

type ChannelModeratedRoles struct {
	Guests  *ChannelModeratedRole `json:"guests"`
	Members *ChannelModeratedRole `json:"members"`
}

type ChannelModeratedRole struct {
	Value   bool `json:"value"`
	Enabled bool `json:"enabled"`
}

type ChannelModerationPatch struct {
	Name  *string                     `json:"name"`
	Roles *ChannelModeratedRolesPatch `json:"roles"`
}

type ChannelModeratedRolesPatch struct {
	Guests  *bool `json:"guests"`
	Members *bool `json:"members"`
}

// ChannelSearchOpts contains options for searching channels.
//
// NotAssociatedToGroup will exclude channels that have associated, active GroupChannels records.
// ExcludeDefaultChannels will exclude the configured default channels (ex 'town-square' and 'off-topic').
// IncludeDeleted will include channel records where DeleteAt != 0.
// ExcludeChannelNames will exclude channels from the results by name.
// IncludeSearchById will include searching matches against channel IDs in the results
// Paginate whether to paginate the results.
// Page page requested, if results are paginated.
// PerPage number of results per page, if paginated.
type ChannelSearchOpts struct {
	NotAssociatedToGroup     string
	ExcludeDefaultChannels   bool
	IncludeDeleted           bool
	Deleted                  bool
	ExcludeChannelNames      []string
	TeamIds                  []string
	GroupConstrained         bool
	ExcludeGroupConstrained  bool
	PolicyID                 string
	ExcludePolicyConstrained bool
	IncludePolicyID          bool
	IncludeSearchById        bool
	Public                   bool
	Private                  bool
	Page                     *int
	PerPage                  *int
	LastDeleteAt             int
	LastUpdateAt             int
}

type ChannelMemberCountByGroup struct {
	GroupId                     string `json:"group_id"`
	ChannelMemberCount          int64  `json:"channel_member_count"`
	ChannelMemberTimezonesCount int64  `json:"channel_member_timezones_count"`
}

type ChannelOption func(channel *Channel)

var gmNameRegex = regexp.MustCompile("^[a-f0-9]{40}$")

func WithID(ID string) ChannelOption {
	return func(channel *Channel) {
		channel.Id = ID
	}
}

// The following are some GraphQL methods necessary to return the
// data in float64 type. The spec doesn't support 64 bit integers,
// so we have to pass the data in float64. The _ at the end is
// a hack to keep the attribute name same in GraphQL schema.

func (o *Channel) CreateAt_() float64 {
	return float64(o.CreateAt)
}

func (o *Channel) UpdateAt_() float64 {
	return float64(o.UpdateAt)
}

func (o *Channel) DeleteAt_() float64 {
	return float64(o.DeleteAt)
}

func (o *Channel) LastPostAt_() float64 {
	return float64(o.LastPostAt)
}

func (o *Channel) TotalMsgCount_() float64 {
	return float64(o.TotalMsgCount)
}

func (o *Channel) TotalMsgCountRoot_() float64 {
	return float64(o.TotalMsgCountRoot)
}

func (o *Channel) LastRootPostAt_() float64 {
	return float64(o.LastRootPostAt)
}

func (o *Channel) ExtraUpdateAt_() float64 {
	return float64(o.ExtraUpdateAt)
}

func (o *Channel) Props_() StringInterface {
	return StringInterface(o.Props)
}

func (o *Channel) DeepCopy() *Channel {
	copy := *o
	if copy.SchemeId != nil {
		copy.SchemeId = NewString(*o.SchemeId)
	}
	return &copy
}

func (o *Channel) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Channel) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.DisplayName) > ChannelDisplayNameMaxRunes {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.display_name.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidChannelIdentifier(o.Name) {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.1_or_more.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !(o.Type == ChannelTypeOpen || o.Type == ChannelTypePrivate || o.Type == ChannelTypeDirect || o.Type == ChannelTypeGroup) {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Header) > ChannelHeaderMaxRunes {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.header.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Purpose) > ChannelPurposeMaxRunes {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.purpose.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.CreatorId) > 26 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.creator_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.Type != ChannelTypeDirect && o.Type != ChannelTypeGroup {
		userIds := strings.Split(o.Name, "__")
		if ok := gmNameRegex.MatchString(o.Name); ok || o.Type != ChannelTypeDirect && len(userIds) == 2 && IsValidId(userIds[0]) && IsValidId(userIds[1]) {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.name.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (o *Channel) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.Name = SanitizeUnicode(o.Name)
	o.DisplayName = SanitizeUnicode(o.DisplayName)
	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}
	o.UpdateAt = o.CreateAt
	o.ExtraUpdateAt = 0
}

func (o *Channel) PreUpdate() {
	o.UpdateAt = GetMillis()
	o.Name = SanitizeUnicode(o.Name)
	o.DisplayName = SanitizeUnicode(o.DisplayName)
}

func (o *Channel) IsGroupOrDirect() bool {
	return o.Type == ChannelTypeDirect || o.Type == ChannelTypeGroup
}

func (o *Channel) IsOpen() bool {
	return o.Type == ChannelTypeOpen
}

func (o *Channel) Patch(patch *ChannelPatch) {
	if patch.DisplayName != nil {
		o.DisplayName = *patch.DisplayName
	}

	if patch.Name != nil {
		o.Name = *patch.Name
	}

	if patch.Header != nil {
		o.Header = *patch.Header
	}

	if patch.Purpose != nil {
		o.Purpose = *patch.Purpose
	}

	if patch.GroupConstrained != nil {
		o.GroupConstrained = patch.GroupConstrained
	}
}

func (o *Channel) MakeNonNil() {
	if o.Props == nil {
		o.Props = make(map[string]any)
	}
}

func (o *Channel) AddProp(key string, value any) {
	o.MakeNonNil()

	o.Props[key] = value
}

func (o *Channel) IsGroupConstrained() bool {
	return o.GroupConstrained != nil && *o.GroupConstrained
}

func (o *Channel) IsShared() bool {
	return o.Shared != nil && *o.Shared
}

func (o *Channel) GetOtherUserIdForDM(userId string) string {
	if o.Type != ChannelTypeDirect {
		return ""
	}

	userIds := strings.Split(o.Name, "__")

	var otherUserId string

	if userIds[0] != userIds[1] {
		if userIds[0] == userId {
			otherUserId = userIds[1]
		} else {
			otherUserId = userIds[0]
		}
	}

	return otherUserId
}

func (ChannelType) ImplementsGraphQLType(name string) bool {
	return name == "ChannelType"
}

func (t ChannelType) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(t))
}

func (t *ChannelType) UnmarshalGraphQL(input any) error {
	chType, ok := input.(string)
	if !ok {
		return errors.New("wrong type")
	}

	*t = ChannelType(chType)
	return nil
}

func GetDMNameFromIds(userId1, userId2 string) string {
	if userId1 > userId2 {
		return userId2 + "__" + userId1
	}
	return userId1 + "__" + userId2
}

func GetGroupDisplayNameFromUsers(users []*User, truncate bool) string {
	usernames := make([]string, len(users))
	for index, user := range users {
		usernames[index] = user.Username
	}

	sort.Strings(usernames)

	name := strings.Join(usernames, ", ")

	if truncate && len(name) > ChannelNameMaxLength {
		name = name[:ChannelNameMaxLength]
	}

	return name
}

func GetGroupNameFromUserIds(userIds []string) string {
	sort.Strings(userIds)

	h := sha1.New()
	for _, id := range userIds {
		io.WriteString(h, id)
	}

	return hex.EncodeToString(h.Sum(nil))
}
