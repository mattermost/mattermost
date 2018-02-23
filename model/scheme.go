// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
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

func (scheme *Scheme) ToJson() string {
	b, _ := json.Marshal(scheme)
	return string(b)
}

func SchemeFromJson(data io.Reader) *Scheme {
	var scheme *Scheme
	json.NewDecoder(data).Decode(&scheme)
	return scheme
}
