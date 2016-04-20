// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

const (
	ROLE_TEAM_ADMIN = "admin"
)

type TeamMember struct {
	TeamId string `json:"team_id"`
	UserId string `json:"user_id"`
	Roles  string `json:"roles"`
}

func (o *TeamMember) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamMemberFromJson(data io.Reader) *TeamMember {
	decoder := json.NewDecoder(data)
	var o TeamMember
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func TeamMembersToJson(o []*TeamMember) string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func TeamMembersFromJson(data io.Reader) []*TeamMember {
	decoder := json.NewDecoder(data)
	var o []*TeamMember
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *TeamMember) IsValid() *AppError {

	if len(o.TeamId) != 26 {
		return NewLocAppError("TeamMember.IsValid", "model.team_member.is_valid.team_id.app_error", nil, "")
	}

	if len(o.UserId) != 26 {
		return NewLocAppError("TeamMember.IsValid", "model.team_member.is_valid.user_id.app_error", nil, "")
	}

	for _, role := range strings.Split(o.Roles, " ") {
		if !(role == "" || role == ROLE_TEAM_ADMIN) {
			return NewLocAppError("TeamMember.IsValid", "model.team_member.is_valid.role.app_error", nil, "role="+role)
		}
	}

	return nil
}
