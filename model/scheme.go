// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SCHEME_NAME_MAX_LENGTH        = 64
	SCHEME_DESCRIPTION_MAX_LENGTH = 1024
	SCHEME_SCOPE_TEAM             = "team"
	SCHEME_SCOPE_CHANNEL          = "channel"
)

type Scheme struct {
	Id                      string `json:"id"`
	Name                    string `json:"name"`
	Description             string `json:"description"`
	CreateAt                int64  `json:"create_at"`
	UpdateAt                int64  `json:"update_at"`
	DeleteAt                int64  `json:"delete_at"`
	Scope                   string `json:"scope"`
	DefaultTeamAdminRole    string `json:"default_team_admin_role"`
	DefaultTeamUserRole     string `json:"default_team_user_role"`
	DefaultChannelAdminRole string `json:"default_channel_admin_role"`
	DefaultChannelUserRole  string `json:"default_channel_user_role"`
}

type SchemeIDPatch struct {
	SchemeID *string `json:"scheme_id"`
}

func (scheme *Scheme) ToJson() string {
	b, _ := json.Marshal(scheme)
	return string(b)
}

func SchemeFromJson(data io.Reader) *Scheme {
	var scheme *Scheme
	json.NewDecoder(data).Decode(&scheme)
	return scheme
}

func (scheme *Scheme) IsValid() bool {
	if len(scheme.Id) != 26 {
		return false
	}

	return scheme.IsValidForCreate()
}

func (scheme *Scheme) IsValidForCreate() bool {
	if len(scheme.Name) == 0 || len(scheme.Name) > SCHEME_NAME_MAX_LENGTH {
		return false
	}

	if len(scheme.Description) > SCHEME_DESCRIPTION_MAX_LENGTH {
		return false
	}

	switch scheme.Scope {
	case SCHEME_SCOPE_TEAM, SCHEME_SCOPE_CHANNEL:
	default:
		return false
	}

	if !IsValidRoleName(scheme.DefaultChannelAdminRole) {
		return false
	}

	if !IsValidRoleName(scheme.DefaultChannelUserRole) {
		return false
	}

	if scheme.Scope == SCHEME_SCOPE_TEAM {
		if !IsValidRoleName(scheme.DefaultTeamAdminRole) {
			return false
		}

		if !IsValidRoleName(scheme.DefaultTeamUserRole) {
			return false
		}
	}

	if scheme.Scope == SCHEME_SCOPE_CHANNEL {
		if len(scheme.DefaultTeamAdminRole) != 0 {
			return false
		}

		if len(scheme.DefaultTeamUserRole) != 0 {
			return false
		}
	}

	return true
}

func SchemeIDFromJson(data io.Reader) *string {
	var p *SchemeIDPatch
	json.NewDecoder(data).Decode(&p)
	return p.SchemeID
}

func (p *SchemeIDPatch) ToJson() string {
	b, _ := json.Marshal(p)
	return string(b)
}
