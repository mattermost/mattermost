// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/app"
	"github.com/mattermost/mattermost-server/v6/server/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/i18n"
)

type MarketplaceProvider struct {
}

const (
	CmdMarketplace = "marketplace"
)

func init() {
	app.RegisterCommandProvider(&MarketplaceProvider{})
}

func (h *MarketplaceProvider) GetTrigger() string {
	return CmdMarketplace
}

func (h *MarketplaceProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	enabled := false
	pluginSettings := a.Config().PluginSettings
	if *pluginSettings.Enable && *pluginSettings.EnableMarketplace {
		enabled = true
	}

	return &model.Command{
		Trigger:          CmdMarketplace,
		AutoComplete:     enabled,
		AutoCompleteDesc: T("api.command_marketplace.desc"),
		DisplayName:      T("api.command_marketplace.name"),
	}
}

func (h *MarketplaceProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_marketplace.unsupported.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
