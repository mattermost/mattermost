// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

type SearchProvider struct {
}

const (
	CmdSearch = "search"
)

func init() {
	app.RegisterCommandProvider(&SearchProvider{})
}

func (search *SearchProvider) GetTrigger() string {
	return CmdSearch
}

func (search *SearchProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdSearch,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_search.desc"),
		AutoCompleteHint: T("api.command_search.hint"),
		DisplayName:      T("api.command_search.name"),
	}
}

func (search *SearchProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_search.unsupported.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
