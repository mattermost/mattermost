// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/gorilla/mux"
)

type ApiParams struct {
	UserId    string
	TeamId    string
	ChannelId string
	PostId    string
	FileId    string
	CommandId string
	HookId    string
	EmojiId   string
}

func ApiParamsFromRequest(r *http.Request) *ApiParams {
	params := &ApiParams{}

	props := mux.Vars(r)

	if val, ok := props["user_id"]; ok {
		params.UserId = val
	}

	if val, ok := props["team_id"]; ok {
		params.TeamId = val
	}

	if val, ok := props["channel_id"]; ok {
		params.ChannelId = val
	}

	if val, ok := props["post_id"]; ok {
		params.PostId = val
	}

	if val, ok := props["file_id"]; ok {
		params.FileId = val
	}

	if val, ok := props["command_id"]; ok {
		params.CommandId = val
	}

	if val, ok := props["hook_id"]; ok {
		params.HookId = val
	}

	if val, ok := props["emoji_id"]; ok {
		params.EmojiId = val
	}

	return params
}
