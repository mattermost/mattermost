// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

type TeamMember struct {
	TeamId   string `json:"team_id"`
	UserId   string `json:"user_id"`
	Roles    string `json:"roles"`
	DeleteAt int64  `json:"delete_at"`
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

func (o *TeamMember) IsInTeamRole(aRole string) bool {
	for _, role := range o.GetRoles() {
		if role == aRole {
			return true
		}
	}
	return false
}

func (o *TeamMember) IsTeamAdmin() bool {
	return o.IsInTeamRole("admin")
}

func (o *TeamMember) IsValid() *AppError {

	if len(o.TeamId) != 26 {
		return NewLocAppError("TeamMember.IsValid", "model.team_member.is_valid.team_id.app_error", nil, "")
	}

	if len(o.UserId) != 26 {
		return NewLocAppError("TeamMember.IsValid", "model.team_member.is_valid.user_id.app_error", nil, "")
	}

	/*for _, role := range strings.Split(o.Roles, " ") {
		if !(role == "" || role == ROLE_TEAM_ADMIN.Id) {
			return NewLocAppError("TeamMember.IsValid", "model.team_member.is_valid.role.app_error", nil, "role="+role)
		}
	}*/

	return nil
}

func (o *TeamMember) PreUpdate() {
}

func (o *TeamMember) GetRoles() []string {
	return strings.Fields(o.Roles)
}
