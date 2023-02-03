// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

type WorkTemplateProvider struct {
}

const (
	CmdWorkTemplate = "worktemplate"
)

func init() {
	app.RegisterCommandProvider(&WorkTemplateProvider{})
}

func (h *WorkTemplateProvider) GetTrigger() string {
	return CmdWorkTemplate
}

func (h *WorkTemplateProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	workTemplateEnabled := a.Config().FeatureFlags.WorkTemplate
	pbActive, err := a.IsPluginActive(model.PluginIdPlaybooks)
	if err != nil {
		pbActive = false
	}
	hasBoard, err := a.HasBoardProduct()
	if err != nil {
		hasBoard = false
	}

	return &model.Command{
		Trigger:          CmdWorkTemplate,
		AutoComplete:     hasBoard && pbActive && workTemplateEnabled,
		AutoCompleteDesc: T("api.command_work_template.desc"),
		DisplayName:      T("api.command_work_template.name"),
	}
}

func (h *WorkTemplateProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_work_template.unsupported.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
