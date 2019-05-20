// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

//go:generate go run params_gen/params_gen.go

package web

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
)

const (
	PAGE_DEFAULT          = 0
	PER_PAGE_DEFAULT      = 60
	PER_PAGE_MAXIMUM      = 200
	LOGS_PER_PAGE_DEFAULT = 10000
	LOGS_PER_PAGE_MAXIMUM = 10000
)

type Params struct {
	UserId                 string `param:"user_id"`
	TeamId                 string `param:"team_id"`
	InviteId               string `param:"invite_id"`
	TokenId                string `param:"token_id"`
	ChannelId              string
	PostId                 string `param:"post_id"`
	FileId                 string `param:"file_id"`
	Filename               string `param:"filename"`
	PluginId               string `param:"plugin_id"`
	CommandId              string `param:"command_id"`
	HookId                 string `param:"hook_id"`
	ReportId               string `param:"report_id"`
	EmojiId                string `param:"emoji_id"`
	AppId                  string `param:"app_id"`
	Email                  string `param:"email"`
	Username               string `param:"username"`
	TeamName               string
	ChannelName            string
	PreferenceName         string `param:"preference_name"`
	EmojiName              string `param:"emoji_name"`
	Category               string `param:"category_name"`
	Service                string `param:"service"`
	JobId                  string `param:"job_id"`
	JobType                string `param:"job_type"`
	ActionId               string `param:"action_id"`
	RoleId                 string `param:"role_id"`
	RoleName               string `param:"role_name"`
	SchemeId               string `param:"scheme_id"`
	Scope                  string `param:"scope,query"`
	GroupId                string `param:"group_id"`
	Page                   int
	PerPage                int
	LogsPerPage            int
	Permanent              bool   `param:"permanent"`
	RemoteId               string `param:"remote_id"`
	SyncableId             string `param:"syncable_id"`
	SyncableType           model.GroupSyncableType
	BotUserId              string `param:"bot_user_id"`
	Q                      string `param:"q,query"`
	IsLinked               *bool  `param:"is_linked"`
	IsConfigured           *bool  `param:"is_configured"`
	NotAssociatedToTeam    string `param:"not_associated_to_team,query"`
	NotAssociatedToChannel string `param:"not_associated_to_channel,query"`
	Paginate               *bool  `param:"paginate"`
	IncludeMemberCount     bool   `param:"include_member_count"`
}

func (p *Params) AddCustomParamsFromRequest(r *http.Request) {
	props := mux.Vars(r)
	query := r.URL.Query()

	if val, ok := props["team_name"]; ok {
		p.TeamName = strings.ToLower(val)
	}

	if val, ok := props["channel_name"]; ok {
		p.ChannelName = strings.ToLower(val)
	}

	if val, err := strconv.Atoi(query.Get("page")); err != nil || val < 0 {
		p.Page = PAGE_DEFAULT
	} else {
		p.Page = val
	}

	if val, err := strconv.Atoi(query.Get("per_page")); err != nil || val < 0 {
		p.PerPage = PER_PAGE_DEFAULT
	} else if val > PER_PAGE_MAXIMUM {
		p.PerPage = PER_PAGE_MAXIMUM
	} else {
		p.PerPage = val
	}

	if val, err := strconv.Atoi(query.Get("logs_per_page")); err != nil || val < 0 {
		p.LogsPerPage = LOGS_PER_PAGE_DEFAULT
	} else if val > LOGS_PER_PAGE_MAXIMUM {
		p.LogsPerPage = LOGS_PER_PAGE_MAXIMUM
	} else {
		p.LogsPerPage = val
	}

	if val, ok := props["syncable_type"]; ok {
		switch val {
		case "teams":
			p.SyncableType = model.GroupSyncableTypeTeam
		case "channels":
			p.SyncableType = model.GroupSyncableTypeChannel
		}
	}

	if val, ok := props["channel_id"]; ok {
		p.ChannelId = val
	} else {
		p.ChannelId = query.Get("channel_id")
	}
}
