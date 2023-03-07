// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/server/v7/channels/app"
	"github.com/mattermost/mattermost-server/server/v7/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/i18n"
)

type TemplatesProvider struct {
}

const (
	CmdTemplates = "templates"
)

func init() {
	app.RegisterCommandProvider(&TemplatesProvider{})
}

func (h *TemplatesProvider) GetTrigger() string {
	return CmdTemplates
}

func (h *TemplatesProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
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
		Trigger:          CmdTemplates,
		AutoComplete:     hasBoard && pbActive && workTemplateEnabled,
		AutoCompleteDesc: T("api.command_templates.desc"),
		DisplayName:      T("api.command_templates.name"),
	}
}

func (h *TemplatesProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_templates.unsupported.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
