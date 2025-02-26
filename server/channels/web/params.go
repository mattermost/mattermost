// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
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
	TimeRange                 string
	ChannelId                 string
	PostId                    string
	PolicyId                  string
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
	IncludeMemberIDs          bool
	NotAssociatedToGroup      string
	ExcludeDefaultChannels    bool
	LimitAfter                int
	LimitBefore               int
	GroupIDs                  string
	IncludeTotalCount         bool
	IncludeDeleted            bool
	FilterAllowReference      bool
	FilterArchived            bool
	FilterParentTeamPermitted bool
	CategoryId                string
	ExportName                string
	ExcludePolicyConstrained  bool
	GroupSource               model.GroupSource
	FilterHasMember           string
	IncludeChannelMemberCount string
	OutgoingOAuthConnectionID string
	ExcludeOffline            bool
	InChannel                 string
	NotInChannel              string
	Topic                     string
	CreatorId                 string
	OnlyConfirmed             bool
	OnlyPlugins               bool
	IncludeUnconfirmed        bool
	ExcludeConfirmed          bool
	ExcludePlugins            bool
	ExcludeHome               bool
	ExcludeRemote             bool

	//Bookmarks
	ChannelBookmarkId string
	BookmarksSince    int64

	// Cloud
	InvoiceId string

	// Custom Profile Attributes
	FieldId string
}

func ParamsFromRequest(r *http.Request) *Params {
	params := &Params{}

	props := mux.Vars(r)
	query := r.URL.Query()

	params.UserId = props["user_id"]
	params.TeamId = props["team_id"]
	params.CategoryId = props["category_id"]
	params.InviteId = props["invite_id"]
	params.TokenId = props["token_id"]
	params.ThreadId = props["thread_id"]

	if val, ok := props["channel_id"]; ok {
		params.ChannelId = val
	} else {
		params.ChannelId = query.Get("channel_id")
	}

	params.PostId = props["post_id"]
	params.PolicyId = props["policy_id"]
	params.FileId = props["file_id"]
	params.Filename = query.Get("filename")
	params.UploadId = props["upload_id"]
	if val, ok := props["plugin_id"]; ok {
		params.PluginId = val
	} else {
		params.PluginId = query.Get("plugin_id")
	}
	params.CommandId = props["command_id"]
	params.HookId = props["hook_id"]
	params.ReportId = props["report_id"]
	params.EmojiId = props["emoji_id"]
	params.AppId = props["app_id"]
	params.Email = props["email"]
	params.Username = props["username"]
	params.TeamName = strings.ToLower(props["team_name"])
	params.ChannelName = strings.ToLower(props["channel_name"])
	params.Category = props["category"]
	params.Service = props["service"]
	params.PreferenceName = props["preference_name"]
	params.EmojiName = props["emoji_name"]
	params.JobId = props["job_id"]
	params.JobType = props["job_type"]
	params.ActionId = props["action_id"]
	params.RoleId = props["role_id"]
	params.RoleName = props["role_name"]
	params.SchemeId = props["scheme_id"]
	params.GroupId = props["group_id"]
	params.RemoteId = props["remote_id"]
	params.InvoiceId = props["invoice_id"]
	params.OutgoingOAuthConnectionID = props["outgoing_oauth_connection_id"]
	params.ExcludeOffline, _ = strconv.ParseBool(query.Get("exclude_offline"))
	params.InChannel = query.Get("in_channel")
	params.NotInChannel = query.Get("not_in_channel")
	params.Topic = query.Get("topic")
	params.CreatorId = query.Get("creator_id")
	params.OnlyConfirmed, _ = strconv.ParseBool(query.Get("only_confirmed"))
	params.OnlyPlugins, _ = strconv.ParseBool(query.Get("only_plugins"))
	params.IncludeUnconfirmed, _ = strconv.ParseBool(query.Get("include_unconfirmed"))
	params.ExcludeConfirmed, _ = strconv.ParseBool(query.Get("exclude_confirmed"))
	params.ExcludePlugins, _ = strconv.ParseBool(query.Get("exclude_plugins"))
	params.ExcludeHome, _ = strconv.ParseBool(query.Get("exclude_home"))
	params.ExcludeRemote, _ = strconv.ParseBool(query.Get("exclude_remote"))
	params.ChannelBookmarkId = props["bookmark_id"]
	params.FieldId = props["field_id"]
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

	params.TimeRange = query.Get("time_range")
	params.Permanent, _ = strconv.ParseBool(query.Get("permanent"))

	val, err := strconv.Atoi(query.Get("per_page"))
	if err != nil || val < 0 {
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

	params.SyncableId = props["syncable_id"]

	switch props["syncable_type"] {
	case "teams":
		params.SyncableType = model.GroupSyncableTypeTeam
	case "channels":
		params.SyncableType = model.GroupSyncableTypeChannel
	}

	params.BotUserId = props["bot_user_id"]
	params.Q = query.Get("q")

	if val, err := strconv.ParseBool(query.Get("is_linked")); err == nil {
		params.IsLinked = &val
	}

	if val, err := strconv.ParseBool(query.Get("is_configured")); err == nil {
		params.IsConfigured = &val
	}

	params.NotAssociatedToTeam = query.Get("not_associated_to_team")
	params.NotAssociatedToChannel = query.Get("not_associated_to_channel")
	params.FilterAllowReference, _ = strconv.ParseBool(query.Get("filter_allow_reference"))
	params.FilterArchived, _ = strconv.ParseBool(query.Get("filter_archived"))
	params.FilterParentTeamPermitted, _ = strconv.ParseBool(query.Get("filter_parent_team_permitted"))
	params.IncludeChannelMemberCount = query.Get("include_channel_member_count")

	if val, err := strconv.ParseBool(query.Get("paginate")); err == nil {
		params.Paginate = &val
	}

	params.IncludeMemberCount, _ = strconv.ParseBool(query.Get("include_member_count"))
	params.IncludeMemberIDs, _ = strconv.ParseBool(query.Get("include_member_ids"))
	params.NotAssociatedToGroup = query.Get("not_associated_to_group")
	params.ExcludeDefaultChannels, _ = strconv.ParseBool(query.Get("exclude_default_channels"))
	params.GroupIDs = query.Get("group_ids")
	params.IncludeTotalCount, _ = strconv.ParseBool(query.Get("include_total_count"))
	params.IncludeDeleted, _ = strconv.ParseBool(query.Get("include_deleted"))
	params.ExportName = props["export_name"]
	params.ExcludePolicyConstrained, _ = strconv.ParseBool(query.Get("exclude_policy_constrained"))

	if val := query.Get("group_source"); val != "" {
		switch val {
		case "custom":
			params.GroupSource = model.GroupSourceCustom
		default:
			params.GroupSource = model.GroupSourceLdap
		}
	}

	params.FilterHasMember = query.Get("filter_has_member")

	if val, err := strconv.ParseInt(query.Get("bookmarks_since"), 10, 64); err != nil || val < 0 {
		params.BookmarksSince = 0
	} else {
		params.BookmarksSince = val
	}

	return params
}
