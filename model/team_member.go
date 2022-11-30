// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"strings"
)

const (
	USERNAME = "Username"
)

// This struct's serializer methods are auto-generated. If a new field is added/removed,
// please run make gen-serialized.
//
//msgp:tuple TeamMember
type TeamMember struct {
	TeamId        string `json:"team_id"`
	UserId        string `json:"user_id"`
	Roles         string `json:"roles"`
	DeleteAt      int64  `json:"delete_at"`
	SchemeGuest   bool   `json:"scheme_guest"`
	SchemeUser    bool   `json:"scheme_user"`
	SchemeAdmin   bool   `json:"scheme_admin"`
	ExplicitRoles string `json:"explicit_roles"`
	CreateAt      int64  `json:"-"`
}

func (o *TeamMember) Auditable() map[string]any {
	return map[string]any{
		"team_id":        o.TeamId,
		"user_id":        o.UserId,
		"roles":          o.Roles,
		"delete_at":      o.DeleteAt,
		"scheme_guest":   o.SchemeGuest,
		"scheme_user":    o.SchemeUser,
		"scheme_admin":   o.SchemeAdmin,
		"explicit_roles": o.ExplicitRoles,
		"create_at":      o.CreateAt,
	}
}

//msgp:ignore TeamUnread
type TeamUnread struct {
	TeamId                   string `json:"team_id"`
	MsgCount                 int64  `json:"msg_count"`
	MentionCount             int64  `json:"mention_count"`
	MentionCountRoot         int64  `json:"mention_count_root"`
	MsgCountRoot             int64  `json:"msg_count_root"`
	ThreadCount              int64  `json:"thread_count"`
	ThreadMentionCount       int64  `json:"thread_mention_count"`
	ThreadUrgentMentionCount int64  `json:"thread_urgent_mention_count"`
}

//msgp:ignore TeamMemberForExport
type TeamMemberForExport struct {
	TeamMember
	TeamName string
}

//msgp:ignore TeamMemberWithError
type TeamMemberWithError struct {
	UserId string      `json:"user_id"`
	Member *TeamMember `json:"member"`
	Error  *AppError   `json:"error"`
}

//msgp:ignore EmailInviteWithError
type EmailInviteWithError struct {
	Email string    `json:"email"`
	Error *AppError `json:"error"`
}

//msgp:ignore TeamMembersGetOptions
type TeamMembersGetOptions struct {
	// Sort the team members. Accepts "Username", but defaults to "Id".
	Sort string

	// If true, exclude team members whose corresponding user is deleted.
	ExcludeDeletedUsers bool

	// Restrict to search in a list of teams and channels
	ViewRestrictions *ViewUsersRestrictions
}

//msgp:ignore TeamInviteReminderData
type TeamInviteReminderData struct {
	Interval string
}

func EmailInviteWithErrorToEmails(o []*EmailInviteWithError) []string {
	var ret []string
	for _, o := range o {
		if o.Error == nil {
			ret = append(ret, o.Email)
		}
	}
	return ret
}

func EmailInviteWithErrorToString(o *EmailInviteWithError) string {
	return fmt.Sprintf("%s:%s", o.Email, o.Error.Error())
}

func TeamMembersWithErrorToTeamMembers(o []*TeamMemberWithError) []*TeamMember {
	var ret []*TeamMember
	for _, o := range o {
		if o.Error == nil {
			ret = append(ret, o.Member)
		}
	}
	return ret
}

func TeamMemberWithErrorToString(o *TeamMemberWithError) string {
	return fmt.Sprintf("%s:%s", o.UserId, o.Error.Error())
}

func (o *TeamMember) IsValid() *AppError {
	if !IsValidId(o.TeamId) {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Roles) > UserRolesMaxLength {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.roles_limit.app_error",
			map[string]any{"Limit": UserRolesMaxLength}, "", http.StatusBadRequest)
	}

	return nil
}

func (o *TeamMember) PreUpdate() {
}

func (o *TeamMember) GetRoles() []string {
	return strings.Fields(o.Roles)
}

// DeleteAt_ returns the deleteAt value in float64. This is necessary to work
// with GraphQL since it doesn't support 64 bit integers.
func (o *TeamMember) DeleteAt_() float64 {
	return float64(o.DeleteAt)
}
