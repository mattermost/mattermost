// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type TeamMember struct {
	TeamId        string `json:"team_id"`
	UserId        string `json:"user_id"`
	Roles         string `json:"roles"`
	DeleteAt      int64  `json:"delete_at"`
	SchemeUser    bool   `json:"scheme_user"`
	SchemeAdmin   bool   `json:"scheme_admin"`
	ExplicitRoles string `json:"explicit_roles"`
}

type TeamUnread struct {
	TeamId       string `json:"team_id"`
	MsgCount     int64  `json:"msg_count"`
	MentionCount int64  `json:"mention_count"`
}

type TeamMemberForExport struct {
	TeamMember
	TeamName string
}

func (o *TeamMember) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func (o *TeamUnread) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func TeamMemberFromJson(data io.Reader) *TeamMember {
	var o *TeamMember
	json.NewDecoder(data).Decode(&o)
	return o
}

func TeamUnreadFromJson(data io.Reader) *TeamUnread {
	var o *TeamUnread
	json.NewDecoder(data).Decode(&o)
	return o
}

func TeamMembersToJson(o []*TeamMember) string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func TeamMembersFromJson(data io.Reader) []*TeamMember {
	var o []*TeamMember
	json.NewDecoder(data).Decode(&o)
	return o
}

func TeamsUnreadToJson(o []*TeamUnread) string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func TeamsUnreadFromJson(data io.Reader) []*TeamUnread {
	var o []*TeamUnread
	json.NewDecoder(data).Decode(&o)
	return o
}

func (o *TeamMember) IsValid() *AppError {

	if len(o.TeamId) != 26 {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.UserId) != 26 {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *TeamMember) PreUpdate() {
}

func (o *TeamMember) GetRoles() []string {
	return strings.Fields(o.Roles)
}
