// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"path"
	"strings"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type ExportLinkProvider struct {
}

const (
	CmdExportLink       = "exportlink"
	LatestExportMessage = "latest"
)

func init() {
	app.RegisterCommandProvider(&ExportLinkProvider{})
}

func (*ExportLinkProvider) GetTrigger() string {
	return CmdExportLink
}

func (*ExportLinkProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	if !a.Config().FeatureFlags.EnableExportDirectDownload {
		return nil
	}

	if !*a.Config().FileSettings.DedicatedExportStore {
		return nil
	}

	b := a.ExportFileBackend()
	_, ok := b.(filestore.FileBackendWithLinkGenerator)
	if !ok {
		return nil
	}

	return &model.Command{
		Trigger:          CmdExportLink,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_exportlink.desc"),
		AutoCompleteHint: T("api.command_exportlink.hint", map[string]any{
			"LatestMsg": LatestExportMessage,
		}),
		DisplayName: T("api.command_exportlink.name"),
	}
}

func (*ExportLinkProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.SessionHasPermissionTo(*c.Session(), model.PermissionManageSystem) {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.permission.app_error")}
	}

	b := a.ExportFileBackend()
	_, ok := b.(filestore.FileBackendWithLinkGenerator)
	if !ok {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.driver.app_error")}
	}

	file := ""
	if message == LatestExportMessage {
		files, err := b.ListDirectory(*a.Config().ExportSettings.Directory)
		if err != nil {
			return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.list.app_error")}
		}
		if len(files) == 0 {
			return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.empty.app_error")}
		}
		latestFound := time.Time{}
		for _, f := range files {
			// find the latest file
			if !strings.HasSuffix(f, "_export.zip") {
				continue
			}
			t, err := b.FileModTime(f)
			if err != nil {
				a.Log().Warn("Failed to get file mod time", logr.String("file", f), logr.Err(err))
				continue
			}
			if t.After(latestFound) {
				file = path.Base(f)
				latestFound = t
			}
		}
	}

	if model.IsValidId(message) {
		file = message + "_export.zip"
	}

	if file == "" {
		file = message
	}
	if !strings.HasSuffix(file, "_export.zip") {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.invalid.app_error")}
	}

	res, err := a.GeneratePresignURLForExport(file)
	if err != nil {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.presign.app_error")}
	}

	// return link
	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_exportlink.link.text", map[string]interface{}{
		"Link":       res.URL,
		"Expiration": res.Expiration.String(),
	})}
}
