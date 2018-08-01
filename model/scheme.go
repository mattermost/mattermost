// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
)

const (
	SCHEME_DISPLAY_NAME_MAX_LENGTH = 128
	SCHEME_NAME_MAX_LENGTH         = 64
	SCHEME_DESCRIPTION_MAX_LENGTH  = 1024
	SCHEME_SCOPE_TEAM              = "team"
	SCHEME_SCOPE_CHANNEL           = "channel"
)

type Scheme struct {
	Id                      string `json:"id"`
	Name                    string `json:"name"`
	DisplayName             string `json:"display_name"`
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

type SchemePatch struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
}

type SchemeIDPatch struct {
	SchemeID *string `json:"scheme_id"`
}

// SchemeConveyor is used for importing and exporting a Scheme and its associated Roles.
type SchemeConveyor struct {
	Name         string  `json:"name"`
	DisplayName  string  `json:"display_name"`
	Description  string  `json:"description"`
	Scope        string  `json:"scope"`
	TeamAdmin    string  `json:"default_team_admin_role"`
	TeamUser     string  `json:"default_team_user_role"`
	ChannelAdmin string  `json:"default_channel_admin_role"`
	ChannelUser  string  `json:"default_channel_user_role"`
	Roles        []*Role `json:"roles"`
}

func (sc *SchemeConveyor) Scheme() *Scheme {
	return &Scheme{
		DisplayName:             sc.DisplayName,
		Name:                    sc.Name,
		Description:             sc.Description,
		Scope:                   sc.Scope,
		DefaultTeamAdminRole:    sc.TeamAdmin,
		DefaultTeamUserRole:     sc.TeamUser,
		DefaultChannelAdminRole: sc.ChannelAdmin,
		DefaultChannelUserRole:  sc.ChannelUser,
	}
}

type SchemeRoles struct {
	SchemeAdmin bool `json:"scheme_admin"`
	SchemeUser  bool `json:"scheme_user"`
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

func SchemesToJson(schemes []*Scheme) string {
	b, _ := json.Marshal(schemes)
	return string(b)
}

func SchemesFromJson(data io.Reader) []*Scheme {
	var schemes []*Scheme
	if err := json.NewDecoder(data).Decode(&schemes); err == nil {
		return schemes
	} else {
		return nil
	}
}

func (scheme *Scheme) IsValid() bool {
	if len(scheme.Id) != 26 {
		return false
	}

	return scheme.IsValidForCreate()
}

func (scheme *Scheme) IsValidForCreate() bool {
	if len(scheme.DisplayName) == 0 || len(scheme.DisplayName) > SCHEME_DISPLAY_NAME_MAX_LENGTH {
		return false
	}

	if !IsValidSchemeName(scheme.Name) {
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

func (scheme *Scheme) Patch(patch *SchemePatch) {
	if patch.DisplayName != nil {
		scheme.DisplayName = *patch.DisplayName
	}
	if patch.Name != nil {
		scheme.Name = *patch.Name
	}
	if patch.Description != nil {
		scheme.Description = *patch.Description
	}
}

func (patch *SchemePatch) ToJson() string {
	b, _ := json.Marshal(patch)
	return string(b)
}

func SchemePatchFromJson(data io.Reader) *SchemePatch {
	var patch *SchemePatch
	json.NewDecoder(data).Decode(&patch)
	return patch
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

func IsValidSchemeName(name string) bool {
	re := regexp.MustCompile(fmt.Sprintf("^[a-z0-9_]{2,%d}$", SCHEME_NAME_MAX_LENGTH))
	return re.MatchString(name)
}

func (schemeRoles *SchemeRoles) ToJson() string {
	b, _ := json.Marshal(schemeRoles)
	return string(b)
}

func SchemeRolesFromJson(data io.Reader) *SchemeRoles {
	var schemeRoles *SchemeRoles
	json.NewDecoder(data).Decode(&schemeRoles)
	return schemeRoles
}
