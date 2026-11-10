// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	ChannelNotifyDefault             = "default"
	ChannelNotifyAll                 = "all"
	ChannelNotifyMention             = "mention"
	ChannelNotifyNone                = "none"
	ChannelMarkUnreadAll             = "all"
	ChannelMarkUnreadMention         = "mention"
	IgnoreChannelMentionsDefault     = "default"
	IgnoreChannelMentionsOff         = "off"
	IgnoreChannelMentionsOn          = "on"
	IgnoreChannelMentionsNotifyProp  = "ignore_channel_mentions"
	ChannelAutoFollowThreadsOff      = "off"
	ChannelAutoFollowThreadsOn       = "on"
	ChannelAutoFollowThreads         = "channel_auto_follow_threads"
	ChannelMemberNotifyPropsMaxRunes = 800000
)

type ChannelUnread struct {
	TeamId             string    `json:"team_id"`
	ChannelId          string    `json:"channel_id"`
	MsgCount           int64     `json:"msg_count"`
	MentionCount       int64     `json:"mention_count"`
	MentionCountRoot   int64     `json:"mention_count_root"`
	UrgentMentionCount int64     `json:"urgent_mention_count"`
	MsgCountRoot       int64     `json:"msg_count_root"`
	NotifyProps        StringMap `json:"-"`
}

type ChannelUnreadAt struct {
	TeamId             string    `json:"team_id"`
	UserId             string    `json:"user_id"`
	ChannelId          string    `json:"channel_id"`
	MsgCount           int64     `json:"msg_count"`
	MentionCount       int64     `json:"mention_count"`
	MentionCountRoot   int64     `json:"mention_count_root"`
	UrgentMentionCount int64     `json:"urgent_mention_count"`
	MsgCountRoot       int64     `json:"msg_count_root"`
	LastViewedAt       int64     `json:"last_viewed_at"`
	NotifyProps        StringMap `json:"-"`
}

type ChannelMember struct {
	ChannelId               string    `json:"channel_id"`
	UserId                  string    `json:"user_id"`
	Roles                   string    `json:"roles"`
	LastViewedAt            int64     `json:"last_viewed_at"`
	MsgCount                int64     `json:"msg_count"`
	MentionCount            int64     `json:"mention_count"`
	MentionCountRoot        int64     `json:"mention_count_root"`
	UrgentMentionCount      int64     `json:"urgent_mention_count"`
	MsgCountRoot            int64     `json:"msg_count_root"`
	NotifyProps             StringMap `json:"notify_props"`
	LastUpdateAt            int64     `json:"last_update_at"`
	SchemeGuest             bool      `json:"scheme_guest"`
	SchemeUser              bool      `json:"scheme_user"`
	SchemeAdmin             bool      `json:"scheme_admin"`
	ExplicitRoles           string    `json:"explicit_roles"`
	AutoTranslationDisabled bool      `json:"autotranslation_disabled"`
}

func (o *ChannelMember) Auditable() map[string]any {
	return map[string]any{
		"channel_id":           o.ChannelId,
		"user_id":              o.UserId,
		"roles":                o.Roles,
		"last_viewed_at":       o.LastViewedAt,
		"msg_count":            o.MsgCount,
		"mention_count":        o.MentionCount,
		"mention_count_root":   o.MentionCountRoot,
		"urgent_mention_count": o.UrgentMentionCount,
		"msg_count_root":       o.MsgCountRoot,
		"notify_props":         o.NotifyProps,
		"last_update_at":       o.LastUpdateAt,
		"scheme_guest":         o.SchemeGuest,
		"scheme_user":          o.SchemeUser,
		"scheme_admin":         o.SchemeAdmin,
		"explicit_roles":       o.ExplicitRoles,
	}
}

// sanitizedTimestamp marks a LastViewedAt/LastUpdateAt field that belongs to
// another user and must be hidden. MarshalJSON omits any field holding this
// sentinel rather than serializing an invalid value
const sanitizedTimestamp int64 = -1

// SanitizeForCurrentUser hides another user's private timestamp fields by
// marking them with the sanitized sentinel, which MarshalJSON then omits from
// API responses. The requester's own values are left untouched.
func (o *ChannelMember) SanitizeForCurrentUser(currentUserId string) {
	if o.UserId != currentUserId {
		o.LastViewedAt = sanitizedTimestamp
		o.LastUpdateAt = sanitizedTimestamp
	}
}

// timestampOrNil returns nil for the sanitized sentinel so that the omitempty
// tag drops the field, and a pointer to the real value otherwise (including a
// legitimate 0).
func timestampOrNil(ts int64) *int64 {
	if ts == sanitizedTimestamp {
		return nil
	}
	return &ts
}

// MarshalJSON serializes the channel member in a single pass, omitting
// last_viewed_at and/or last_update_at when they hold the sanitized sentinel
// written by SanitizeForCurrentUser. The shadowing pointer fields allow for a
// direct marshal with the sanitized values removed if needed.
func (o ChannelMember) MarshalJSON() ([]byte, error) {
	type alias ChannelMember
	return json.Marshal(&struct {
		*alias
		LastViewedAt *int64 `json:"last_viewed_at,omitempty"`
		LastUpdateAt *int64 `json:"last_update_at,omitempty"`
	}{
		alias:        (*alias)(&o),
		LastViewedAt: timestampOrNil(o.LastViewedAt),
		LastUpdateAt: timestampOrNil(o.LastUpdateAt),
	})
}

// ChannelMemberWithTeamData contains ChannelMember appended with extra team information
// as well.
//
// Any new non-embedded field added here must also be added to MarshalJSON below,
// otherwise it will be silently dropped from the JSON output.
type ChannelMemberWithTeamData struct {
	ChannelMember
	TeamDisplayName string `json:"team_display_name"`
	TeamName        string `json:"team_name"`
	TeamUpdateAt    int64  `json:"team_update_at"`
}

// MarshalJSON flattens the embedded ChannelMember together with the team fields
// in a single pass. It is required because ChannelMember's MarshalJSON would
// otherwise be promoted and drop the team fields entirely.
func (o ChannelMemberWithTeamData) MarshalJSON() ([]byte, error) {
	type alias ChannelMember
	return json.Marshal(&struct {
		*alias
		LastViewedAt    *int64 `json:"last_viewed_at,omitempty"`
		LastUpdateAt    *int64 `json:"last_update_at,omitempty"`
		TeamDisplayName string `json:"team_display_name"`
		TeamName        string `json:"team_name"`
		TeamUpdateAt    int64  `json:"team_update_at"`
	}{
		alias:           (*alias)(&o.ChannelMember),
		LastViewedAt:    timestampOrNil(o.LastViewedAt),
		LastUpdateAt:    timestampOrNil(o.LastUpdateAt),
		TeamDisplayName: o.TeamDisplayName,
		TeamName:        o.TeamName,
		TeamUpdateAt:    o.TeamUpdateAt,
	})
}

type ChannelMembers []ChannelMember

type ChannelMembersWithTeamData []ChannelMemberWithTeamData

// ChannelMemberForExport is only converted field-by-field for export and is
// never JSON-marshaled. If that changes, it must define its own MarshalJSON;
// otherwise ChannelMember's promoted MarshalJSON drops ChannelName and Username.
type ChannelMemberForExport struct {
	ChannelMember
	ChannelName string
	Username    string
}

type ChannelMemberCursor struct {
	Page          int // If page is -1, then FromChannelID is used as a cursor.
	PerPage       int
	FromChannelID string
}

func (o *ChannelMember) IsValid() *AppError {
	if !IsValidId(o.ChannelId) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if appErr := IsChannelMemberNotifyPropsValid(o.NotifyProps, false); appErr != nil {
		return appErr
	}

	if len(o.Roles) > UserRolesMaxLength {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.roles_limit.app_error",
			map[string]any{"Limit": UserRolesMaxLength}, "", http.StatusBadRequest)
	}

	return nil
}

func IsChannelMemberNotifyPropsValid(notifyProps map[string]string, allowMissingFields bool) *AppError {
	if notifyLevel, ok := notifyProps[DesktopNotifyProp]; ok || !allowMissingFields {
		if len(notifyLevel) > 20 || !IsChannelNotifyLevelValid(notifyLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.notify_level.app_error", nil, "notify_level="+notifyLevel, http.StatusBadRequest)
		}
	}

	if markUnreadLevel, ok := notifyProps[MarkUnreadNotifyProp]; ok || !allowMissingFields {
		if len(markUnreadLevel) > 20 || !IsChannelMarkUnreadLevelValid(markUnreadLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.unread_level.app_error", nil, "mark_unread_level="+markUnreadLevel, http.StatusBadRequest)
		}
	}

	if pushLevel, ok := notifyProps[PushNotifyProp]; ok {
		if len(pushLevel) > 20 || !IsChannelNotifyLevelValid(pushLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.push_level.app_error", nil, "push_notification_level="+pushLevel, http.StatusBadRequest)
		}
	}

	if sendEmail, ok := notifyProps[EmailNotifyProp]; ok {
		if len(sendEmail) > 20 || !IsSendEmailValid(sendEmail) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.email_value.app_error", nil, "push_notification_level="+sendEmail, http.StatusBadRequest)
		}
	}

	if ignoreChannelMentions, ok := notifyProps[IgnoreChannelMentionsNotifyProp]; ok {
		if len(ignoreChannelMentions) > 40 || !IsIgnoreChannelMentionsValid(ignoreChannelMentions) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.ignore_channel_mentions_value.app_error", nil, "ignore_channel_mentions="+ignoreChannelMentions, http.StatusBadRequest)
		}
	}

	if channelAutoFollowThreads, ok := notifyProps[ChannelAutoFollowThreads]; ok {
		if len(channelAutoFollowThreads) > 3 || !IsChannelAutoFollowThreadsValid(channelAutoFollowThreads) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.channel_auto_follow_threads_value.app_error", nil, "channel_auto_follow_threads="+channelAutoFollowThreads, http.StatusBadRequest)
		}
	}

	jsonStringNotifyProps := string(ToJSON(notifyProps))
	if utf8.RuneCountInString(jsonStringNotifyProps) > ChannelMemberNotifyPropsMaxRunes {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.notify_props.app_error", nil, fmt.Sprint("length=", utf8.RuneCountInString(jsonStringNotifyProps)), http.StatusBadRequest)
	}

	return nil
}

func (o *ChannelMember) PreSave() {
	o.LastUpdateAt = GetMillis()
}

func (o *ChannelMember) PreUpdate() {
	o.LastUpdateAt = GetMillis()
}

func (o *ChannelMember) GetRoles() []string {
	return strings.Fields(o.Roles)
}

func (o *ChannelMember) SetChannelMuted(muted bool) {
	if o.IsChannelMuted() {
		o.NotifyProps[MarkUnreadNotifyProp] = ChannelMarkUnreadAll
	} else {
		o.NotifyProps[MarkUnreadNotifyProp] = ChannelMarkUnreadMention
	}
}

func (o *ChannelMember) IsChannelMuted() bool {
	return o.NotifyProps[MarkUnreadNotifyProp] == ChannelMarkUnreadMention
}

func IsChannelNotifyLevelValid(notifyLevel string) bool {
	return notifyLevel == ChannelNotifyDefault ||
		notifyLevel == ChannelNotifyAll ||
		notifyLevel == ChannelNotifyMention ||
		notifyLevel == ChannelNotifyNone
}

func IsChannelMarkUnreadLevelValid(markUnreadLevel string) bool {
	return markUnreadLevel == ChannelMarkUnreadAll || markUnreadLevel == ChannelMarkUnreadMention
}

func IsSendEmailValid(sendEmail string) bool {
	return sendEmail == ChannelNotifyDefault || sendEmail == "true" || sendEmail == "false"
}

func IsIgnoreChannelMentionsValid(ignoreChannelMentions string) bool {
	return ignoreChannelMentions == IgnoreChannelMentionsOn || ignoreChannelMentions == IgnoreChannelMentionsOff || ignoreChannelMentions == IgnoreChannelMentionsDefault
}

func IsChannelAutoFollowThreadsValid(channelAutoFollowThreads string) bool {
	return channelAutoFollowThreads == ChannelAutoFollowThreadsOn || channelAutoFollowThreads == ChannelAutoFollowThreadsOff
}

func GetDefaultChannelNotifyProps() StringMap {
	return StringMap{
		DesktopNotifyProp:               ChannelNotifyDefault,
		MarkUnreadNotifyProp:            ChannelMarkUnreadAll,
		PushNotifyProp:                  ChannelNotifyDefault,
		EmailNotifyProp:                 ChannelNotifyDefault,
		IgnoreChannelMentionsNotifyProp: IgnoreChannelMentionsDefault,
		ChannelAutoFollowThreads:        ChannelAutoFollowThreadsOff,
	}
}

type ChannelMemberIdentifier struct {
	ChannelId string `json:"channel_id"`
	UserId    string `json:"user_id"`
}

// SetChannelMembersRequest is the request body for the bulk set channel members endpoint.
type SetChannelMembersRequest struct {
	// Members is the complete desired membership list. Users in this list
	// (and in ChannelAdmins) will be the final set of channel members.
	Members []string `json:"members"`
	// ChannelAdmins is an optional list of user IDs that should have the
	// channel admin role. Users in this list are automatically included in
	// the desired membership (they do not need to also appear in Members).
	// When nil, existing admin roles are preserved for members who remain
	// in the channel. When non-nil (including empty slice), admin roles
	// are set declaratively: listed users become admins, all others lose
	// the admin role.
	ChannelAdmins *[]string `json:"channel_admins"`
}

// SetChannelMembersResponse is one batch of results from a bulk set channel members operation.
// Multiple responses may be streamed as NDJSON lines.
type SetChannelMembersResponse struct {
	Added    []string                 `json:"added"`
	Removed  []string                 `json:"removed"`
	Promoted []string                 `json:"promoted,omitempty"`
	Demoted  []string                 `json:"demoted,omitempty"`
	Errors   []SetChannelMembersError `json:"errors,omitempty"`
}

func (o *SetChannelMembersResponse) Auditable() map[string]any {
	return map[string]any{
		"added":    o.Added,
		"removed":  o.Removed,
		"promoted": o.Promoted,
		"demoted":  o.Demoted,
		"errors":   o.Errors,
	}
}

type SetChannelMembersError struct {
	UserID string `json:"user_id"`
	ID     string `json:"id"`
	Error  string `json:"error"`
}
