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

func mobileLogsCrossUserUnavailableResponse(args *model.CommandArgs) *model.CommandResponse {
	return &model.CommandResponse{
		Text:         args.T("api.command_mobile_logs.cross_user_unavailable.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}

func logMobileLogsAttachAppLogsAudit(a *app.App, rctx request.CTX, actorUserID, targetUserID, value string) {
	rec := &model.AuditRecord{
		EventName: model.AuditEventUpdatePreferences,
		Status:    model.AuditStatusSuccess,
		Actor: model.AuditEventActor{
			UserId:        actorUserID,
			SessionId:     rctx.Session().Id,
			Client:        rctx.UserAgent(),
			IpAddress:     rctx.IPAddress(),
			XForwardedFor: rctx.XForwardedFor(),
		},
		Meta: map[string]any{
			model.AuditKeyAPIPath:   rctx.Path(),
			model.AuditKeyClusterID: a.GetClusterId(),
		},
		EventData: model.AuditEventData{
			Parameters: map[string]any{
				"source":              "slash_command/" + CmdMobileLogs,
				"target_user_id":      targetUserID,
				"preference_category": model.PreferenceCategoryAdvancedSettings,
				"preference_name":     model.PreferenceNameAttachAppLogs,
				"value":               value,
			},
			PriorState:  map[string]any{},
			ResultState: map[string]any{},
			ObjectType:  "user_preference",
		},
	}
	a.LogAuditRecWithLevel(rctx, rec, app.LevelAPI, nil)
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
	if len(fields) == 0 || len(fields) > 2 {
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
				Text:         args.T("api.command_mobile_logs.user_not_found.app_error", map[string]any{"Username": username}),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

		caller, appErr := a.GetUser(args.UserId)
		if appErr != nil {
			rctx.Logger().Error("Failed to get caller for mobile-logs command", mlog.String("user_id", args.UserId), mlog.Err(appErr))
			return &model.CommandResponse{
				Text:         args.T("api.command_mobile_logs.update_error.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}

		isSelf := username == strings.ToLower(caller.Username)
		if isSelf {
			targetUserID = caller.Id
			targetDisplayName = "@" + caller.Username
		} else {
			// Cross-user: callers without system admin get one neutral outcome for any failure
			// (unknown user, deactivated, disallowed target, or missing role) to avoid username
			// enumeration. System admins still get explicit not-found messages for support workflows.
			if !a.HasPermissionTo(args.UserId, model.PermissionManageSystem) && !a.HasPermissionTo(args.UserId, model.PermissionEditOtherUsers) {
				return mobileLogsCrossUserUnavailableResponse(args)
			}

			callerHasManageSystem := a.HasPermissionTo(args.UserId, model.PermissionManageSystem)

			targetUser, lookupErr := a.GetUserByUsername(username)
			if lookupErr != nil {
				if lookupErr.StatusCode == http.StatusNotFound {
					if callerHasManageSystem {
						return &model.CommandResponse{
							Text:         args.T("api.command_mobile_logs.user_not_found.app_error", map[string]any{"Username": username}),
							ResponseType: model.CommandResponseTypeEphemeral,
						}
					}
					return mobileLogsCrossUserUnavailableResponse(args)
				}
				rctx.Logger().Error("Failed to get user by username", mlog.String("username", username), mlog.Err(lookupErr))
				if callerHasManageSystem {
					return &model.CommandResponse{
						Text:         args.T("api.command_mobile_logs.user_not_found.app_error", map[string]any{"Username": username}),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
				return mobileLogsCrossUserUnavailableResponse(args)
			}

			if targetUser.DeleteAt != 0 {
				if callerHasManageSystem {
					return &model.CommandResponse{
						Text:         args.T("api.command_mobile_logs.user_not_found.app_error", map[string]any{"Username": username}),
						ResponseType: model.CommandResponseTypeEphemeral,
					}
				}
				return mobileLogsCrossUserUnavailableResponse(args)
			}

			targetUserID = targetUser.Id
			targetDisplayName = "@" + targetUser.Username

			if !callerHasManageSystem && targetUser.IsSystemAdmin() {
				return mobileLogsCrossUserUnavailableResponse(args)
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
				Text:         args.T("api.command_mobile_logs.update_error.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		logMobileLogsAttachAppLogsAudit(a, rctx, args.UserId, targetUserID, "true")
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
				Text:         args.T("api.command_mobile_logs.update_error.app_error"),
				ResponseType: model.CommandResponseTypeEphemeral,
			}
		}
		logMobileLogsAttachAppLogsAudit(a, rctx, args.UserId, targetUserID, "false")
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

	default:
		// Defensive: action is already validated to be "on", "off", or "status" above.
		return &model.CommandResponse{
			Text:         args.T("api.command_mobile_logs.usage"),
			ResponseType: model.CommandResponseTypeEphemeral,
		}
	}
}
