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
	PageDefault        = 0
	PerPageDefault     = 60
	PerPageMaximum     = 200
	LogsPerPageDefault = 10000
	LogsPerPageMaximum = 10000
	LimitDefault       = 60
	LimitMaximum       = 200
)

type Params struct {
	UserId                    string
	TeamId                    string
	InviteId                  string
	TokenId                   string
	ThreadId                  string
	Timestamp                 int64
	ChannelId                 string
	PostId                    string
	FileId                    string
	Filename                  string
	UploadId                  string
	PluginId                  string
	CommandId                 string
	HookId                    string
	ReportId                  string
	EmojiId                   string
	AppId                     string
	Email                     string
	Username                  string
	TeamName                  string
	ChannelName               string
	PreferenceName            string
	EmojiName                 string
	Category                  string
	Service                   string
	JobId                     string
	JobType                   string
	ActionId                  string
	RoleId                    string
	RoleName                  string
	SchemeId                  string
	Scope                     string
	GroupId                   string
	Page                      int
	PerPage                   int
	LogsPerPage               int
	Permanent                 bool
	RemoteId                  string
	SyncableId                string
	SyncableType              model.GroupSyncableType
	BotUserId                 string
	Q                         string
	IsLinked                  *bool
	IsConfigured              *bool
	NotAssociatedToTeam       string
	NotAssociatedToChannel    string
	Paginate                  *bool
	IncludeMemberCount        bool
	NotAssociatedToGroup      string
	ExcludeDefaultChannels    bool
	LimitAfter                int
	LimitBefore               int
	GroupIDs                  string
	IncludeTotalCount         bool
	IncludeDeleted            bool
	FilterAllowReference      bool
	FilterParentTeamPermitted bool
	CategoryId                string
	WarnMetricId              string
	ExportName                string

	// Cloud
	InvoiceId string
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

	if val, ok := props["category_id"]; ok {
		params.CategoryId = val
	}

	if val, ok := props["invite_id"]; ok {
		params.InviteId = val
	}

	if val, ok := props["token_id"]; ok {
		params.TokenId = val
	}

	if val, ok := props["thread_id"]; ok {
		params.ThreadId = val
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

	if val, ok := props["upload_id"]; ok {
		params.UploadId = val
	}

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

	if val, ok := props["invoice_id"]; ok {
		params.InvoiceId = val
	}

	params.Scope = query.Get("scope")

	if val, err := strconv.Atoi(query.Get("page")); err != nil || val < 0 {
		params.Page = PageDefault
	} else {
		params.Page = val
	}

	if val, err := strconv.ParseInt(props["timestamp"], 10, 64); err != nil || val < 0 {
		params.Timestamp = 0
	} else {
		params.Timestamp = val
	}

	if val, err := strconv.ParseBool(query.Get("permanent")); err == nil {
		params.Permanent = val
	}

	if val, err := strconv.Atoi(query.Get("per_page")); err != nil || val < 0 {
		params.PerPage = PerPageDefault
	} else if val > PerPageMaximum {
		params.PerPage = PerPageMaximum
	} else {
		params.PerPage = val
	}

	if val, err := strconv.Atoi(query.Get("logs_per_page")); err != nil || val < 0 {
		params.LogsPerPage = LogsPerPageDefault
	} else if val > LogsPerPageMaximum {
		params.LogsPerPage = LogsPerPageMaximum
	} else {
		params.LogsPerPage = val
	}

	if val, err := strconv.Atoi(query.Get("limit_after")); err != nil || val < 0 {
		params.LimitAfter = LimitDefault
	} else if val > LimitMaximum {
		params.LimitAfter = LimitMaximum
	} else {
		params.LimitAfter = val
	}

	if val, err := strconv.Atoi(query.Get("limit_before")); err != nil || val < 0 {
		params.LimitBefore = LimitDefault
	} else if val > LimitMaximum {
		params.LimitBefore = LimitMaximum
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

	if val, err := strconv.ParseBool(query.Get("filter_allow_reference")); err == nil {
		params.FilterAllowReference = val
	}

	if val, err := strconv.ParseBool(query.Get("filter_parent_team_permitted")); err == nil {
		params.FilterParentTeamPermitted = val
	}

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

	if val, err := strconv.ParseBool(query.Get("include_deleted")); err == nil {
		params.IncludeDeleted = val
	}

	if val, ok := props["warn_metric_id"]; ok {
		params.WarnMetricId = val
	}

	if val, ok := props["export_name"]; ok {
		params.ExportName = val
	}

	return params
}
