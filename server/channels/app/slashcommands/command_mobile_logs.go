// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type MobileLogsProvider struct {
}

const (
	CmdMobileLogs = "mobile-logs"
)

func init() {
	app.RegisterCommandProvider(&MobileLogsProvider{})
}

func (*MobileLogsProvider) GetTrigger() string {
	return CmdMobileLogs
}

func (*MobileLogsProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdMobileLogs,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_mobile_logs.desc"),
		AutoCompleteHint: T("api.command_mobile_logs.hint"),
		DisplayName:      T("api.command_mobile_logs.name"),
	}
}

func (*MobileLogsProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	fields := strings.Fields(message)
	if len(fields) == 0 {
		return &model.CommandResponse{
			Text:         args.T("api.command_mobile_logs.usage"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	action := strings.ToLower(fields[0])
	if action != "on" && action != "off" && action != "status" {
		return &model.CommandResponse{
			Text:         args.T("api.command_mobile_logs.usage"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	targetUserID := args.UserId
	targetDisplayName := args.T("api.command_mobile_logs.you")

	if len(fields) > 1 {
		username := strings.TrimPrefix(fields[1], "@")
		username = strings.ToLower(username)

		if !model.IsValidUsername(username) {
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.user_not_found", map[string]any{"Username": username}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

		targetUser, appErr := a.GetUserByUsername(username)
		if appErr != nil {
			if appErr.StatusCode == http.StatusNotFound {
				return &model.CommandResponse{
					Text:         args.T("api.command_mobile_logs.user_not_found", map[string]any{"Username": username}),
					ResponseType: model.CommandResponseTypeEphemeral,
				}
			}
			rctx.Logger().Error("Failed to get user by username", mlog.String("username", username), mlog.Err(appErr))
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.user_not_found", map[string]any{"Username": username}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

		if targetUser.DeleteAt != 0 {
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.user_not_found", map[string]any{"Username": username}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

		targetUserID = targetUser.Id
		targetDisplayName = "@" + targetUser.Username

		if targetUserID != args.UserId {
			if !a.HasPermissionTo(args.UserId, model.PermissionManageSystem) {
				if !a.HasPermissionTo(args.UserId, model.PermissionEditOtherUsers) {
					return &model.CommandResponse{
						Text:         args.T("api.command_mobile_logs.no_permission"),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
				if targetUser.IsSystemAdmin() {
					return &model.CommandResponse{
						Text:         args.T("api.command_mobile_logs.no_permission"),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
			}
		}
	}

	switch action {
	case "on":
		prefs := model.Preferences{
			{
				UserId:   targetUserID,
				Category: model.PreferenceCategoryAdvancedSettings,
				Name:     model.PreferenceNameAttachAppLogs,
				Value:    "true",
			},
		}
		if err := a.UpdatePreferences(rctx, targetUserID, prefs); err != nil {
			rctx.Logger().Error("Failed to update attach_app_logs preference", mlog.String("user_id", targetUserID), mlog.Err(err))
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.update_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		return &model.CommandResponse{
			Text:         args.T("api.command_mobile_logs.enabled", map[string]any{"User": targetDisplayName}),
			ResponseType: model.CommandResponseTypeEphemeral,
		}

	case "off":
		prefs := model.Preferences{
			{
				UserId:   targetUserID,
				Category: model.PreferenceCategoryAdvancedSettings,
				Name:     model.PreferenceNameAttachAppLogs,
				Value:    "false",
			},
		}
		if err := a.UpdatePreferences(rctx, targetUserID, prefs); err != nil {
			rctx.Logger().Error("Failed to update attach_app_logs preference", mlog.String("user_id", targetUserID), mlog.Err(err))
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.update_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		return &model.CommandResponse{
			Text:         args.T("api.command_mobile_logs.disabled", map[string]any{"User": targetDisplayName}),
			ResponseType: model.CommandResponseTypeEphemeral,
		}

	case "status":
		pref, err := a.GetPreferenceByCategoryAndNameForUser(rctx, targetUserID, model.PreferenceCategoryAdvancedSettings, model.PreferenceNameAttachAppLogs)
		if err != nil {
			rctx.Logger().Debug("Could not get attach_app_logs preference, defaulting to off", mlog.String("user_id", targetUserID), mlog.Err(err))
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.status_off", map[string]any{"User": targetDisplayName}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		if pref.Value == "true" {
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.status_on", map[string]any{"User": targetDisplayName}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		return &model.CommandResponse{
			Text:         args.T("api.command_mobile_logs.status_off", map[string]any{"User": targetDisplayName}),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}

	return &model.CommandResponse{
		Text:         args.T("api.command_mobile_logs.usage"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
