// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type SearchProvider struct {
}

const (
	CMD_SEARCH = "search"
)

func init() {
	RegisterCommandProvider(&SearchProvider{})
}

func (search *SearchProvider) GetTrigger() string {
	return CMD_SEARCH
}

func (search *SearchProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_SEARCH,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_search.desc"),
		AutoCompleteHint: T("api.command_search.hint"),
		DisplayName:      T("api.command_search.name"),
	}
}

func (search *SearchProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_search.unsupported.app_error"),
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
	}
}
