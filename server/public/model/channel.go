// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha1"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

var (
	// Validates both 3-digit (#RGB) and 6-digit (#RRGGBB) hex colors
	channelHexColorRegex = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)
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
	ChannelBannerInfoMaxLength = 1024

	ChannelSortByUsername = "username"
	ChannelSortByStatus   = "status"
)

type ChannelBannerInfo struct {
	Enabled         *bool   `json:"enabled"`
	Text            *string `json:"text"`
	BackgroundColor *string `json:"background_color"`
}

func (c *ChannelBannerInfo) Scan(value any) error {
	if value == nil {
		return nil
	}

	b, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("expected []byte, got %T", value)
	}

	return json.Unmarshal(b, c)
}

func (c ChannelBannerInfo) Value() (driver.Value, error) {
	if c == (ChannelBannerInfo{}) {
		return nil, nil
	}

	j, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	return string(j), nil
}

type Channel struct {
	Id                string             `json:"id"`
	CreateAt          int64              `json:"create_at"`
	UpdateAt          int64              `json:"update_at"`
	DeleteAt          int64              `json:"delete_at"`
	TeamId            string             `json:"team_id"`
	Type              ChannelType        `json:"type"`
	DisplayName       string             `json:"display_name"`
	Name              string             `json:"name"`
	Header            string             `json:"header"`
	Purpose           string             `json:"purpose"`
	LastPostAt        int64              `json:"last_post_at"`
	TotalMsgCount     int64              `json:"total_msg_count"`
	ExtraUpdateAt     int64              `json:"extra_update_at"`
	CreatorId         string             `json:"creator_id"`
	SchemeId          *string            `json:"scheme_id"`
	Props             map[string]any     `json:"props"`
	GroupConstrained  *bool              `json:"group_constrained"`
	Shared            *bool              `json:"shared"`
	TotalMsgCountRoot int64              `json:"total_msg_count_root"`
	PolicyID          *string            `json:"policy_id"`
	LastRootPostAt    int64              `json:"last_root_post_at"`
	BannerInfo        *ChannelBannerInfo `json:"banner_info"`
	PolicyEnforced    bool               `json:"policy_enforced"`
}

func (o *Channel) Auditable() map[string]any {
	return map[string]any{
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
		"policy_enforced":      o.PolicyEnforced,
	}
}

func (o *Channel) LogClone() any {
	return o.Auditable()
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
	DisplayName      *string            `json:"display_name"`
	Name             *string            `json:"name"`
	Header           *string            `json:"header"`
	Purpose          *string            `json:"purpose"`
	GroupConstrained *bool              `json:"group_constrained"`
	Type             ChannelType        `json:"type"`
	BannerInfo       *ChannelBannerInfo `json:"banner_info"`
}

func (c *ChannelPatch) Auditable() map[string]any {
	return map[string]any{
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
	Members []*ChannelMemberForExport
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

func (c *ChannelModerationPatch) Auditable() map[string]any {
	return map[string]any{
		"name":  c.Name,
		"roles": c.Roles,
	}
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
// ExcludeAccessPolicyEnforced will exclude channels that are enforced by an access policy.
type ChannelSearchOpts struct {
	NotAssociatedToGroup               string
	ExcludeDefaultChannels             bool
	IncludeDeleted                     bool // If true, deleted channels will be included in the results.
	Deleted                            bool
	ExcludeChannelNames                []string
	TeamIds                            []string
	GroupConstrained                   bool
	ExcludeGroupConstrained            bool
	PolicyID                           string
	ExcludePolicyConstrained           bool
	IncludePolicyID                    bool
	IncludeSearchById                  bool
	ExcludeRemote                      bool
	Public                             bool
	Private                            bool
	Page                               *int
	PerPage                            *int
	LastDeleteAt                       int // When combined with IncludeDeleted, only channels deleted after this time will be returned.
	LastUpdateAt                       int
	AccessControlPolicyEnforced        bool
	ExcludeAccessControlPolicyEnforced bool
	ParentAccessControlPolicyId        string
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

func (o *Channel) DeepCopy() *Channel {
	cCopy := *o
	if cCopy.SchemeId != nil {
		cCopy.SchemeId = NewPointer(*o.SchemeId)
	}
	return &cCopy
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
		if ok := gmNameRegex.MatchString(o.Name); ok || (o.Type != ChannelTypeDirect && len(userIds) == 2 && IsValidId(userIds[0]) && IsValidId(userIds[1])) {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.name.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if o.BannerInfo != nil && o.BannerInfo.Enabled != nil && *o.BannerInfo.Enabled {
		if o.Type != ChannelTypeOpen && o.Type != ChannelTypePrivate {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.banner_info.channel_type.app_error", nil, "", http.StatusBadRequest)
		}

		if o.BannerInfo.Text == nil || len(*o.BannerInfo.Text) == 0 {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.banner_info.text.empty.app_error", nil, "", http.StatusBadRequest)
		} else if len(*o.BannerInfo.Text) > ChannelBannerInfoMaxLength {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.banner_info.text.invalid_length.app_error", map[string]any{"maxLength": ChannelBannerInfoMaxLength}, "", http.StatusBadRequest)
		}

		if o.BannerInfo.BackgroundColor == nil || len(*o.BannerInfo.BackgroundColor) == 0 {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.banner_info.background_color.empty.app_error", nil, "", http.StatusBadRequest)
		}

		if !channelHexColorRegex.MatchString(*o.BannerInfo.BackgroundColor) {
			return NewAppError("Channel.IsValid", "model.channel.is_valid.banner_info.background_color.invalid.app_error", nil, "", http.StatusBadRequest)
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

	// patching channel banner info
	if patch.BannerInfo != nil {
		if o.BannerInfo == nil {
			o.BannerInfo = &ChannelBannerInfo{}
		}

		if patch.BannerInfo.Enabled != nil {
			o.BannerInfo.Enabled = patch.BannerInfo.Enabled
		}

		if patch.BannerInfo.Text != nil {
			o.BannerInfo.Text = patch.BannerInfo.Text
		}

		if patch.BannerInfo.BackgroundColor != nil {
			o.BannerInfo.BackgroundColor = patch.BannerInfo.BackgroundColor
		}
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
	user1, user2 := o.GetBothUsersForDM()

	if user2 == "" {
		return ""
	}

	if user1 == userId {
		return user2
	}

	return user1
}

func (o *Channel) GetBothUsersForDM() (string, string) {
	if o.Type != ChannelTypeDirect {
		return "", ""
	}

	userIds := strings.Split(o.Name, "__")
	if len(userIds) != 2 {
		return "", ""
	}

	if userIds[0] == userIds[1] {
		return userIds[0], ""
	}

	return userIds[0], userIds[1]
}

func (o *Channel) Sanitize() Channel {
	return Channel{
		Id:          o.Id,
		TeamId:      o.TeamId,
		Type:        o.Type,
		DisplayName: o.DisplayName,
	}
}

func (t ChannelType) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(t))
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

type GroupMessageConversionRequestBody struct {
	ChannelID   string `json:"channel_id"`
	TeamID      string `json:"team_id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
}
