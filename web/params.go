// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	PAGE_DEFAULT          = 0
	PER_PAGE_DEFAULT      = 60
	PER_PAGE_MAXIMUM      = 200
	LOGS_PER_PAGE_DEFAULT = 10000
	LOGS_PER_PAGE_MAXIMUM = 10000
	LIMIT_DEFAULT         = 60
	LIMIT_MAXIMUM         = 200
)

type Params struct {
	UserId                 string
	TeamId                 string
	InviteId               string
	TokenId                string
	ChannelId              string
	PostId                 string
	FileId                 string
	Filename               string
	PluginId               string
	CommandId              string
	HookId                 string
	ReportId               string
	EmojiId                string
	AppId                  string
	Email                  string
	Username               string
	TeamName               string
	ChannelName            string
	PreferenceName         string
	EmojiName              string
	Category               string
	Service                string
	JobId                  string
	JobType                string
	ActionId               string
	RoleId                 string
	RoleName               string
	SchemeId               string
	Scope                  string
	GroupId                string
	Page                   int
	PerPage                int
	LogsPerPage            int
	Permanent              bool
	RemoteId               string
	SyncableId             string
	SyncableType           model.GroupSyncableType
	BotUserId              string
	Q                      string
	IsLinked               *bool
	IsConfigured           *bool
	NotAssociatedToTeam    string
	NotAssociatedToChannel string
	Paginate               *bool
	IncludeMemberCount     bool
	NotAssociatedToGroup   string
	ExcludeDefaultChannels bool
	LimitAfter             int
	LimitBefore            int
	GroupIDs               string
	IncludeTotalCount      bool
}

func ParamsFromRequest(r *http.Request) *Params {
	params := &Params{}

	props := mux.Vars(r)
	query := r.URL.Query()

	if val, ok := props["user_id"]; ok {
		params.UserId = val
	}

	if val, ok := props["team_id"]; ok {
		params.TeamId = val
	}

	if val, ok := props["invite_id"]; ok {
		params.InviteId = val
	}

	if val, ok := props["token_id"]; ok {
		params.TokenId = val
	}

	if val, ok := props["channel_id"]; ok {
		params.ChannelId = val
	} else {
		params.ChannelId = query.Get("channel_id")
	}

	if val, ok := props["post_id"]; ok {
		params.PostId = val
	}

	if val, ok := props["file_id"]; ok {
		params.FileId = val
	}

	params.Filename = query.Get("filename")

	if val, ok := props["plugin_id"]; ok {
		params.PluginId = val
	}

	if val, ok := props["command_id"]; ok {
		params.CommandId = val
	}

	if val, ok := props["hook_id"]; ok {
		params.HookId = val
	}

	if val, ok := props["report_id"]; ok {
		params.ReportId = val
	}

	if val, ok := props["emoji_id"]; ok {
		params.EmojiId = val
	}

	if val, ok := props["app_id"]; ok {
		params.AppId = val
	}

	if val, ok := props["email"]; ok {
		params.Email = val
	}

	if val, ok := props["username"]; ok {
		params.Username = val
	}

	if val, ok := props["team_name"]; ok {
		params.TeamName = strings.ToLower(val)
	}

	if val, ok := props["channel_name"]; ok {
		params.ChannelName = strings.ToLower(val)
	}

	if val, ok := props["category"]; ok {
		params.Category = val
	}

	if val, ok := props["service"]; ok {
		params.Service = val
	}

	if val, ok := props["preference_name"]; ok {
		params.PreferenceName = val
	}

	if val, ok := props["emoji_name"]; ok {
		params.EmojiName = val
	}

	if val, ok := props["job_id"]; ok {
		params.JobId = val
	}

	if val, ok := props["job_type"]; ok {
		params.JobType = val
	}

	if val, ok := props["action_id"]; ok {
		params.ActionId = val
	}

	if val, ok := props["role_id"]; ok {
		params.RoleId = val
	}

	if val, ok := props["role_name"]; ok {
		params.RoleName = val
	}

	if val, ok := props["scheme_id"]; ok {
		params.SchemeId = val
	}

	if val, ok := props["group_id"]; ok {
		params.GroupId = val
	}

	if val, ok := props["remote_id"]; ok {
		params.RemoteId = val
	}

	params.Scope = query.Get("scope")

	if val, err := strconv.Atoi(query.Get("page")); err != nil || val < 0 {
		params.Page = PAGE_DEFAULT
	} else {
		params.Page = val
	}

	if val, err := strconv.ParseBool(query.Get("permanent")); err == nil {
		params.Permanent = val
	}

	if val, err := strconv.Atoi(query.Get("per_page")); err != nil || val < 0 {
		params.PerPage = PER_PAGE_DEFAULT
	} else if val > PER_PAGE_MAXIMUM {
		params.PerPage = PER_PAGE_MAXIMUM
	} else {
		params.PerPage = val
	}

	if val, err := strconv.Atoi(query.Get("logs_per_page")); err != nil || val < 0 {
		params.LogsPerPage = LOGS_PER_PAGE_DEFAULT
	} else if val > LOGS_PER_PAGE_MAXIMUM {
		params.LogsPerPage = LOGS_PER_PAGE_MAXIMUM
	} else {
		params.LogsPerPage = val
	}

	if val, err := strconv.Atoi(query.Get("limit_after")); err != nil || val < 0 {
		params.LimitAfter = LIMIT_DEFAULT
	} else if val > LIMIT_MAXIMUM {
		params.LimitAfter = LIMIT_MAXIMUM
	} else {
		params.LimitAfter = val
	}

	if val, err := strconv.Atoi(query.Get("limit_before")); err != nil || val < 0 {
		params.LimitBefore = LIMIT_DEFAULT
	} else if val > LIMIT_MAXIMUM {
		params.LimitBefore = LIMIT_MAXIMUM
	} else {
		params.LimitBefore = val
	}

	if val, ok := props["syncable_id"]; ok {
		params.SyncableId = val
	}

	if val, ok := props["syncable_type"]; ok {
		switch val {
		case "teams":
			params.SyncableType = model.GroupSyncableTypeTeam
		case "channels":
			params.SyncableType = model.GroupSyncableTypeChannel
		}
	}

	if val, ok := props["bot_user_id"]; ok {
		params.BotUserId = val
	}

	params.Q = query.Get("q")

	if val, err := strconv.ParseBool(query.Get("is_linked")); err == nil {
		params.IsLinked = &val
	}

	if val, err := strconv.ParseBool(query.Get("is_configured")); err == nil {
		params.IsConfigured = &val
	}

	params.NotAssociatedToTeam = query.Get("not_associated_to_team")
	params.NotAssociatedToChannel = query.Get("not_associated_to_channel")

	if val, err := strconv.ParseBool(query.Get("paginate")); err == nil {
		params.Paginate = &val
	}

	if val, err := strconv.ParseBool(query.Get("include_member_count")); err == nil {
		params.IncludeMemberCount = val
	}

	params.NotAssociatedToGroup = query.Get("not_associated_to_group")

	if val, err := strconv.ParseBool(query.Get("exclude_default_channels")); err == nil {
		params.ExcludeDefaultChannels = val
	}

	params.GroupIDs = query.Get("group_ids")

	if val, err := strconv.ParseBool(query.Get("include_total_count")); err == nil {
		params.IncludeTotalCount = val
	}

	return params
}
