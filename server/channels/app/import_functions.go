// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/app/teams"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// -- Bulk Import Functions --
// These functions import data directly into the database. Security and permission checks are bypassed but validity is
// still enforced.
func (a *App) importScheme(rctx request.CTX, data *imports.SchemeImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Name != nil {
		fields = append(fields, mlog.String("scheme_name", *data.Name))
	}
	rctx.Logger().Info("Validating scheme", fields...)

	if err := imports.ValidateSchemeImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	rctx.Logger().Info("Importing scheme", fields...)

	scheme, err := a.GetSchemeByName(*data.Name)
	if err != nil {
		scheme = new(model.Scheme)
	} else if scheme.Scope != *data.Scope {
		return model.NewAppError("BulkImport", "app.import.import_scheme.scope_change.error", map[string]any{"SchemeName": scheme.Name}, "", http.StatusBadRequest)
	}

	scheme.Name = *data.Name
	scheme.DisplayName = *data.DisplayName
	scheme.Scope = *data.Scope

	if data.Description != nil {
		scheme.Description = *data.Description
	}

	if scheme.Id == "" {
		scheme, err = a.CreateScheme(scheme)
	} else {
		scheme, err = a.UpdateScheme(scheme)
	}

	if err != nil {
		return err
	}

	if scheme.Scope == model.SchemeScopeTeam {
		data.DefaultTeamAdminRole.Name = &scheme.DefaultTeamAdminRole
		if err := a.importRole(rctx, data.DefaultTeamAdminRole, dryRun); err != nil {
			return err
		}

		data.DefaultTeamUserRole.Name = &scheme.DefaultTeamUserRole
		if err := a.importRole(rctx, data.DefaultTeamUserRole, dryRun); err != nil {
			return err
		}

		if data.DefaultTeamGuestRole == nil {
			data.DefaultTeamGuestRole = &imports.RoleImportData{
				DisplayName:   model.NewPointer("Team Guest Role for Scheme"),
				SchemeManaged: model.NewPointer(true),
			}
		}
		data.DefaultTeamGuestRole.Name = &scheme.DefaultTeamGuestRole
		if err := a.importRole(rctx, data.DefaultTeamGuestRole, dryRun); err != nil {
			return err
		}
	}

	if scheme.Scope == model.SchemeScopeTeam || scheme.Scope == model.SchemeScopeChannel {
		data.DefaultChannelAdminRole.Name = &scheme.DefaultChannelAdminRole
		if err := a.importRole(rctx, data.DefaultChannelAdminRole, dryRun); err != nil {
			return err
		}

		data.DefaultChannelUserRole.Name = &scheme.DefaultChannelUserRole
		if err := a.importRole(rctx, data.DefaultChannelUserRole, dryRun); err != nil {
			return err
		}

		if data.DefaultChannelGuestRole == nil {
			data.DefaultChannelGuestRole = &imports.RoleImportData{
				DisplayName:   model.NewPointer("Channel Guest Role for Scheme"),
				SchemeManaged: model.NewPointer(true),
			}
		}
		data.DefaultChannelGuestRole.Name = &scheme.DefaultChannelGuestRole
		if err := a.importRole(rctx, data.DefaultChannelGuestRole, dryRun); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) importRole(rctx request.CTX, data *imports.RoleImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Name != nil {
		fields = append(fields, mlog.String("role_name", *data.Name))
	}

	rctx.Logger().Info("Validating role", fields...)

	if err := imports.ValidateRoleImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	rctx.Logger().Info("Importing role", fields...)

	role, err := a.GetRoleByName(context.Background(), *data.Name)
	if err != nil {
		role = new(model.Role)
	}

	role.Name = *data.Name

	if data.DisplayName != nil {
		role.DisplayName = *data.DisplayName
	}

	if data.Description != nil {
		role.Description = *data.Description
	}

	if data.Permissions != nil {
		role.Permissions = *data.Permissions
	}

	if data.SchemeManaged != nil {
		role.SchemeManaged = *data.SchemeManaged
	}

	if role.Id == "" {
		_, err = a.CreateRole(role)
	} else {
		_, err = a.UpdateRole(role)
	}

	return err
}

func (a *App) importTeam(rctx request.CTX, data *imports.TeamImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Name != nil {
		fields = append(fields, mlog.String("team_name", *data.Name))
	}
	rctx.Logger().Info("Validating team", fields...)

	if err := imports.ValidateTeamImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	rctx.Logger().Info("Importing team", fields...)
	teamName := strings.ToLower(*data.Name)

	var team *model.Team
	team, err := a.Srv().Store().Team().GetByName(teamName)

	if err != nil {
		team = &model.Team{
			Name: teamName,
		}
	}

	team.DisplayName = *data.DisplayName
	team.Type = *data.Type

	if data.Description != nil {
		team.Description = *data.Description
	}

	if data.AllowOpenInvite != nil {
		team.AllowOpenInvite = *data.AllowOpenInvite
	}

	if data.Scheme != nil {
		scheme, err := a.GetSchemeByName(*data.Scheme)
		if err != nil {
			return err
		}

		if scheme.DeleteAt != 0 {
			return model.NewAppError("BulkImport", "app.import.import_team.scheme_deleted.error", nil, "", http.StatusBadRequest)
		}

		if scheme.Scope != model.SchemeScopeTeam {
			return model.NewAppError("BulkImport", "app.import.import_team.scheme_wrong_scope.error", nil, "", http.StatusBadRequest)
		}

		team.SchemeId = &scheme.Id
	}

	if team.Id == "" {
		if _, err := a.CreateTeam(rctx, team); err != nil {
			return err
		}
	} else {
		if _, err := a.ch.srv.teamService.UpdateTeam(team, teams.UpdateOptions{Imported: true}); err != nil {
			var invErr *store.ErrInvalidInput
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return model.NewAppError("BulkImport", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
			case errors.As(err, &invErr):
				return model.NewAppError("BulkImport", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			default:
				return model.NewAppError("BulkImport", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	return nil
}

func (a *App) importChannel(rctx request.CTX, data *imports.ChannelImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Name != nil {
		fields = append(fields, mlog.String("channel_name", *data.Name))
	}
	rctx.Logger().Info("Validating channel", fields...)

	if err := imports.ValidateChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	teamName := strings.ToLower(*data.Team)
	channelName := strings.ToLower(*data.Name)

	rctx.Logger().Info("Importing channel", fields...)

	team, err := a.Srv().Store().Team().GetByName(teamName)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_channel.team_not_found.error", map[string]any{"TeamName": teamName}, "", http.StatusBadRequest).Wrap(err)
	}

	var channel *model.Channel
	if result, gErr := a.Srv().Store().Channel().GetByNameIncludeDeleted(team.Id, channelName, true); gErr == nil {
		channel = result
	} else {
		channel = &model.Channel{
			Name: channelName,
		}
	}

	channel.TeamId = team.Id
	channel.DisplayName = *data.DisplayName
	channel.Type = *data.Type

	if data.Header != nil {
		channel.Header = *data.Header
	}

	if data.Purpose != nil {
		channel.Purpose = *data.Purpose
	}

	if data.Scheme != nil {
		scheme, err := a.GetSchemeByName(*data.Scheme)
		if err != nil {
			return err
		}

		if scheme.DeleteAt != 0 {
			return model.NewAppError("BulkImport", "app.import.import_channel.scheme_deleted.error", nil, "", http.StatusBadRequest)
		}

		if scheme.Scope != model.SchemeScopeChannel {
			return model.NewAppError("BulkImport", "app.import.import_channel.scheme_wrong_scope.error", nil, "", http.StatusBadRequest)
		}

		channel.SchemeId = &scheme.Id
	}

	var chErr *model.AppError
	if channel.Id == "" {
		if _, chErr = a.CreateChannel(rctx, channel, false); chErr != nil {
			return chErr
		}
	} else {
		if _, chErr = a.UpdateChannel(rctx, channel); chErr != nil {
			return chErr
		}
	}

	if data.DeletedAt != nil && *data.DeletedAt > 0 {
		if err := a.Srv().Store().Channel().Delete(channel.Id, *data.DeletedAt); err != nil {
			return model.NewAppError("BulkImport", "app.import.import_channel.deleting.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) importUser(rctx request.CTX, data *imports.UserImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Username != nil {
		fields = append(fields, mlog.String("user_name", *data.Username))
	}
	rctx.Logger().Info("Validating user", fields...)

	if err := imports.ValidateUserImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	rctx.Logger().Info("Importing user", fields...)

	// We want to avoid database writes if nothing has changed.
	hasUserChanged := false
	hasNotifyPropsChanged := false
	hasUserRolesChanged := false
	hasUserAuthDataChanged := false
	hasUserEmailVerifiedChanged := false

	var user *model.User
	var nErr error
	user, nErr = a.Srv().Store().User().GetByUsername(*data.Username)
	if nErr != nil {
		user = &model.User{}
		user.MakeNonNil()
		user.SetDefaultNotifications()
		hasUserChanged = true
	}

	user.Username = *data.Username

	if user.Email != *data.Email {
		hasUserChanged = true
		hasUserEmailVerifiedChanged = true // Changing the email resets email verified to false by default.
		user.Email = *data.Email
		user.Email = strings.ToLower(user.Email)
	}

	var password string
	var authService string
	var authData *string

	if data.AuthService != nil {
		if user.AuthService != *data.AuthService {
			hasUserAuthDataChanged = true
		}
		authService = *data.AuthService
	}

	// AuthData and Password are mutually exclusive.
	if data.AuthData != nil {
		if user.AuthData == nil || *user.AuthData != *data.AuthData {
			hasUserAuthDataChanged = true
		}
		authData = data.AuthData
		password = ""
	} else if data.Password != nil {
		password = *data.Password
		authData = nil
	} else {
		var err error
		// If no AuthData or Password is specified, we must generate a password.
		password, err = generatePassword(*a.Config().PasswordSettings.MinimumLength)
		if err != nil {
			return model.NewAppError("importUser", "app.import.generate_password.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		authData = nil
	}

	user.Password = password
	user.AuthService = authService
	user.AuthData = authData

	// Automatically assume all emails are verified.
	emailVerified := true
	if user.EmailVerified != emailVerified {
		user.EmailVerified = emailVerified
		hasUserEmailVerifiedChanged = true
	}

	if data.Nickname != nil {
		if user.Nickname != *data.Nickname {
			user.Nickname = *data.Nickname
			hasUserChanged = true
		}
	}

	if data.FirstName != nil {
		if user.FirstName != *data.FirstName {
			user.FirstName = *data.FirstName
			hasUserChanged = true
		}
	}

	if data.LastName != nil {
		if user.LastName != *data.LastName {
			user.LastName = *data.LastName
			hasUserChanged = true
		}
	}

	if data.Position != nil {
		if user.Position != *data.Position {
			user.Position = *data.Position
			hasUserChanged = true
		}
	}

	if data.Locale != nil {
		if user.Locale != *data.Locale {
			user.Locale = *data.Locale
			hasUserChanged = true
		}
	} else {
		if user.Locale != *a.Config().LocalizationSettings.DefaultClientLocale {
			user.Locale = *a.Config().LocalizationSettings.DefaultClientLocale
			hasUserChanged = true
		}
	}

	if data.DeleteAt != nil {
		if user.DeleteAt != *data.DeleteAt {
			user.DeleteAt = *data.DeleteAt
			hasUserChanged = true
		}
	}

	var roles string
	if data.Roles != nil {
		if user.Roles != *data.Roles {
			roles = *data.Roles
			hasUserRolesChanged = true
		}
	} else if user.Roles == "" {
		// Set SYSTEM_USER roles on newly created users by default.
		if user.Roles != model.SystemUserRoleId {
			roles = model.SystemUserRoleId
			hasUserRolesChanged = true
		}
	}
	user.Roles = roles

	if data.NotifyProps != nil {
		if data.NotifyProps.Desktop != nil {
			if value, ok := user.NotifyProps[model.DesktopNotifyProp]; !ok || value != *data.NotifyProps.Desktop {
				user.AddNotifyProp(model.DesktopNotifyProp, *data.NotifyProps.Desktop)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.DesktopSound != nil {
			if value, ok := user.NotifyProps[model.DesktopSoundNotifyProp]; !ok || value != *data.NotifyProps.DesktopSound {
				user.AddNotifyProp(model.DesktopSoundNotifyProp, *data.NotifyProps.DesktopSound)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.Email != nil {
			if value, ok := user.NotifyProps[model.EmailNotifyProp]; !ok || value != *data.NotifyProps.Email {
				user.AddNotifyProp(model.EmailNotifyProp, *data.NotifyProps.Email)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.Mobile != nil {
			if value, ok := user.NotifyProps[model.PushNotifyProp]; !ok || value != *data.NotifyProps.Mobile {
				user.AddNotifyProp(model.PushNotifyProp, *data.NotifyProps.Mobile)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.MobilePushStatus != nil {
			if value, ok := user.NotifyProps[model.PushStatusNotifyProp]; !ok || value != *data.NotifyProps.MobilePushStatus {
				user.AddNotifyProp(model.PushStatusNotifyProp, *data.NotifyProps.MobilePushStatus)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.ChannelTrigger != nil {
			if value, ok := user.NotifyProps[model.ChannelMentionsNotifyProp]; !ok || value != *data.NotifyProps.ChannelTrigger {
				user.AddNotifyProp(model.ChannelMentionsNotifyProp, *data.NotifyProps.ChannelTrigger)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.CommentsTrigger != nil {
			if value, ok := user.NotifyProps[model.CommentsNotifyProp]; !ok || value != *data.NotifyProps.CommentsTrigger {
				user.AddNotifyProp(model.CommentsNotifyProp, *data.NotifyProps.CommentsTrigger)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.MentionKeys != nil {
			if value, ok := user.NotifyProps[model.MentionKeysNotifyProp]; !ok || value != *data.NotifyProps.MentionKeys {
				user.AddNotifyProp(model.MentionKeysNotifyProp, *data.NotifyProps.MentionKeys)
				hasNotifyPropsChanged = true
			}
		} else {
			user.UpdateMentionKeysFromUsername("")
		}
	}

	if data.CustomStatus != nil {
		if err := user.SetCustomStatus(data.CustomStatus); err != nil {
			return model.NewAppError("importUser", "app.import.custom_status.error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	var savedUser *model.User
	var err error
	if user.Id == "" {
		if savedUser, err = a.ch.srv.userService.CreateUser(rctx, user, users.UserCreateOptions{FromImport: true}); err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &appErr):
				return appErr
			case errors.Is(err, users.AcceptedDomainError):
				return model.NewAppError("importUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			case errors.Is(err, users.UserStoreIsEmptyError):
				return model.NewAppError("importUser", "app.user.store_is_empty.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			case errors.As(err, &invErr):
				switch invErr.Field {
				case "email":
					return model.NewAppError("importUser", "app.user.save.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
				case "username":
					return model.NewAppError("importUser", "app.user.save.username_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
				default:
					return model.NewAppError("importUser", "app.user.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
				}
			default:
				return model.NewAppError("importUser", "app.user.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		pref := model.Preference{UserId: savedUser.Id, Category: model.PreferenceCategoryTutorialSteps, Name: savedUser.Id, Value: "0"}
		if err := a.Srv().Store().Preference().Save(model.Preferences{pref}); err != nil {
			rctx.Logger().Warn("Encountered error saving tutorial preference", mlog.Err(err))
		}
	} else {
		var appErr *model.AppError
		if hasUserChanged {
			if savedUser, appErr = a.UpdateUser(rctx, user, false); appErr != nil {
				return appErr
			}
		}
		if hasUserRolesChanged {
			if savedUser, appErr = a.UpdateUserRoles(rctx, user.Id, roles, false); appErr != nil {
				return appErr
			}
		}
		if hasNotifyPropsChanged {
			if appErr = a.updateUserNotifyProps(user.Id, user.NotifyProps); appErr != nil {
				return appErr
			}
			if savedUser, appErr = a.GetUser(user.Id); appErr != nil {
				return appErr
			}
		}
		if password != "" {
			if appErr = a.UpdatePassword(rctx, user, password); appErr != nil {
				return appErr
			}
		} else {
			if hasUserAuthDataChanged {
				if _, nErr := a.Srv().Store().User().UpdateAuthData(user.Id, authService, authData, user.Email, false); nErr != nil {
					var invErr *store.ErrInvalidInput
					switch {
					case errors.As(nErr, &invErr):
						return model.NewAppError("importUser", "app.user.update_auth_data.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
					default:
						return model.NewAppError("importUser", "app.user.update_auth_data.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
					}
				}
			}
		}
		if emailVerified {
			if hasUserEmailVerifiedChanged {
				if err := a.VerifyUserEmail(user.Id, user.Email); err != nil {
					return err
				}
			}
		}
	}

	if savedUser == nil {
		savedUser = user
	}

	if data.Avatar.ProfileImage != nil {
		appErr := a.importProfileImage(rctx, savedUser.Id, &data.Avatar)
		if appErr != nil {
			return appErr
		}
	}

	// Preferences.
	var preferences model.Preferences

	if data.Theme != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryTheme,
			Name:     "",
			Value:    *data.Theme,
		})
	}

	if data.UseMilitaryTime != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameUseMilitaryTime,
			Value:    *data.UseMilitaryTime,
		})
	}

	if data.CollapsePreviews != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameCollapseSetting,
			Value:    *data.CollapsePreviews,
		})
	}

	if data.MessageDisplay != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameMessageDisplay,
			Value:    *data.MessageDisplay,
		})
	}

	if data.CollapseConsecutive != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameCollapseConsecutive,
			Value:    *data.CollapseConsecutive,
		})
	}

	if data.ColorizeUsernames != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameColorizeUsernames,
			Value:    *data.ColorizeUsernames,
		})
	}

	if data.ChannelDisplayMode != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameChannelDisplayMode,
			Value:    *data.ChannelDisplayMode,
		})
	}

	if data.TutorialStep != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryTutorialSteps,
			Name:     savedUser.Id,
			Value:    *data.TutorialStep,
		})
	}

	if data.UseMarkdownPreview != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "feature_enabled_markdown_preview",
			Value:    *data.UseMarkdownPreview,
		})
	}

	if data.UseFormatting != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "formatting",
			Value:    *data.UseFormatting,
		})
	}

	if data.ShowUnreadSection != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategorySidebarSettings,
			Name:     "show_unread_section",
			Value:    *data.ShowUnreadSection,
		})
	}

	if data.SendOnCtrlEnter != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "send_on_ctrl_enter",
			Value:    *data.SendOnCtrlEnter,
		})
	}

	if data.CodeBlockCtrlEnter != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "code_block_ctrl_enter",
			Value:    *data.CodeBlockCtrlEnter,
		})
	}

	if data.ShowJoinLeave != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "join_leave",
			Value:    *data.ShowJoinLeave,
		})
	}

	if data.ShowUnreadScrollPosition != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "unread_scroll_position",
			Value:    *data.ShowUnreadScrollPosition,
		})
	}

	if data.SyncDrafts != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryAdvancedSettings,
			Name:     "sync_drafts",
			Value:    *data.SyncDrafts,
		})
	}

	if data.LimitVisibleDmsGms != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategorySidebarSettings,
			Name:     model.PreferenceLimitVisibleDmsGms,
			Value:    *data.LimitVisibleDmsGms,
		})
	}

	if data.NameFormat != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PreferenceCategoryDisplaySettings,
			Name:     model.PreferenceNameNameFormat,
			Value:    *data.NameFormat,
		})
	}

	if data.EmailInterval != nil || savedUser.NotifyProps[model.EmailNotifyProp] == "false" {
		var intervalSeconds string
		if value := savedUser.NotifyProps[model.EmailNotifyProp]; value == "false" {
			intervalSeconds = "0"
		} else {
			switch *data.EmailInterval {
			case model.PreferenceEmailIntervalImmediately:
				intervalSeconds = model.PreferenceEmailIntervalNoBatchingSeconds
			case model.PreferenceEmailIntervalFifteen:
				intervalSeconds = model.PreferenceEmailIntervalFifteenAsSeconds
			case model.PreferenceEmailIntervalHour:
				intervalSeconds = model.PreferenceEmailIntervalHourAsSeconds
			}
		}
		if intervalSeconds != "" {
			preferences = append(preferences, model.Preference{
				UserId:   savedUser.Id,
				Category: model.PreferenceCategoryNotifications,
				Name:     model.PreferenceNameEmailInterval,
				Value:    intervalSeconds,
			})
		}
	}

	if len(preferences) > 0 {
		if err := a.Srv().Store().Preference().Save(preferences); err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user.save_preferences.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return a.importUserTeams(rctx, savedUser, data.Teams)
}

func (a *App) importBot(rctx request.CTX, data *imports.BotImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Username != nil {
		fields = append(fields, mlog.String("user_name", *data.Username))
	}
	rctx.Logger().Info("Validating bot", fields...)

	if err := imports.ValidateBotImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	rctx.Logger().Info("Importing bot", fields...)

	// We want to avoid database writes if nothing has changed.
	hasBotChanged := false

	var bot *model.Bot
	var nErr error
	bot, nErr = a.Srv().Store().Bot().GetByUsername(*data.Username)
	if nErr != nil {
		bot = &model.Bot{}
		hasBotChanged = true
	}

	bot.Username = *data.Username

	if data.Description != nil && bot.Description != *data.Description {
		bot.Description = *data.Description
		hasBotChanged = true
	}

	if data.DisplayName != nil && bot.DisplayName != *data.DisplayName {
		bot.DisplayName = *data.DisplayName
		hasBotChanged = true
	}

	var owner *model.User
	if data.Owner != nil {
		owner, nErr = a.Srv().Store().User().GetByUsername(*data.Owner)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				// If the owner does not exist, we assume the owner is a plugin hence keeping the owner username as is.
				bot.OwnerId = *data.Owner
			default:
				return model.NewAppError("importBot", "app.import.import_bot.owner_could_not_found.error", map[string]any{"Owner": *data.Owner}, "", http.StatusInternalServerError).Wrap(nErr)
			}
		} else {
			bot.OwnerId = owner.Id
		}
	}

	var savedBot *model.Bot
	if bot.UserId == "" {
		var appErr *model.AppError
		if savedBot, appErr = a.CreateBot(rctx, bot); appErr != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(appErr, &invErr):
				switch invErr.Field {
				case "username":
					return model.NewAppError("importUser", "app.user.save.username_exists.app_error", nil, "", http.StatusBadRequest).Wrap(appErr)
				default:
					return model.NewAppError("importUser", "app.user.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(appErr)
				}
			default:
				return appErr
			}
		}
	} else if hasBotChanged {
		var err error
		if savedBot, err = a.Srv().Store().Bot().Update(bot); err != nil {
			return model.NewAppError("importBot", "app.bot.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if savedBot == nil {
		savedBot = bot
	}

	if data.Avatar.ProfileImage != nil {
		appErr := a.importProfileImage(rctx, savedBot.UserId, &data.Avatar)
		if appErr != nil {
			return appErr
		}
	}

	return nil
}

func (a *App) importProfileImage(rctx request.CTX, userID string, data *imports.Avatar) *model.AppError {
	var file io.ReadSeeker
	var err error
	if data.ProfileImageData != nil {
		// *zip.File does not support Seek, and we need a seeker to reset the cursor position after checking the picture dimension
		var f io.ReadCloser
		f, err = data.ProfileImageData.Open()
		if err != nil {
			return model.NewAppError("importProfileImage", "app.import.profile_image.open.app_error", map[string]any{"FileName": data.ProfileImageData.Name}, "", http.StatusInternalServerError).Wrap(err)
		}

		defer func() {
			if closeErr := f.Close(); closeErr != nil {
				rctx.Logger().Warn("Unable to close profile image data.", mlog.String("filename", data.ProfileImageData.Name), mlog.Err(closeErr))
			}
		}()

		limitedReader := io.LimitReader(f, *a.Config().FileSettings.MaxFileSize)
		var b []byte
		b, err = io.ReadAll(limitedReader)
		if err != nil {
			return model.NewAppError("importProfileImage", "app.import.profile_image.read_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		file = bytes.NewReader(b)
	} else {
		path := *data.ProfileImage
		file, err = os.Open(path)
		if err != nil {
			return model.NewAppError("importProfileImage", "app.import.profile_image.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		defer func() {
			if closeErr := file.(*os.File).Close(); closeErr != nil {
				rctx.Logger().Warn("Unable to close profile image file.", mlog.String("filepath", path), mlog.Err(closeErr))
			}
		}()
	}

	if file != nil {
		if err := checkImageLimits(file, *a.Config().FileSettings.MaxImageResolution); err != nil {
			return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.check_image_limits.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if appErr := a.SetProfileImageFromFile(rctx, userID, file); appErr != nil {
			return appErr
		}
	}

	return nil
}

func (a *App) importUserTeams(rctx request.CTX, user *model.User, data *[]imports.UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	teamNames := []string{}
	for _, tdata := range *data {
		teamNames = append(teamNames, *tdata.Name)
	}
	allTeams, appErr := a.getTeamsByNames(teamNames)
	if appErr != nil {
		return appErr
	}

	var (
		teamThemePreferencesByID = map[string]model.Preferences{}
		channels                 = map[string][]imports.UserChannelImportData{}
		teamsByID                = map[string]*model.Team{}
		teamMemberByTeamID       = map[string]*model.TeamMember{}
		newTeamMembers           = []*model.TeamMember{}
		oldTeamMembers           = []*model.TeamMember{}
		rolesByTeamID            = map[string]string{}
		isGuestByTeamID          = map[string]bool{}
		isUserByTeamId           = map[string]bool{}
		isAdminByTeamID          = map[string]bool{}
	)

	existingMemberships, nErr := a.Srv().Store().Team().GetTeamsForUser(rctx, user.Id, "", true)
	if nErr != nil {
		return model.NewAppError("importUserTeams", "app.team.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	existingMembershipsByTeamId := map[string]*model.TeamMember{}
	for _, teamMembership := range existingMemberships {
		existingMembershipsByTeamId[teamMembership.TeamId] = teamMembership
	}
	for _, tdata := range *data {
		team := allTeams[strings.ToLower(*tdata.Name)]

		// Team-specific theme Preferences.
		if tdata.Theme != nil {
			teamThemePreferencesByID[team.Id] = append(teamThemePreferencesByID[team.Id], model.Preference{
				UserId:   user.Id,
				Category: model.PreferenceCategoryTheme,
				Name:     team.Id,
				Value:    *tdata.Theme,
			})
		}

		isGuestByTeamID[team.Id] = false
		isUserByTeamId[team.Id] = true
		isAdminByTeamID[team.Id] = false

		if tdata.Roles == nil {
			isUserByTeamId[team.Id] = true
		} else {
			rawRoles := *tdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.TeamGuestRoleId {
					isGuestByTeamID[team.Id] = true
					isUserByTeamId[team.Id] = false
				} else if role == model.TeamUserRoleId {
					isUserByTeamId[team.Id] = true
				} else if role == model.TeamAdminRoleId {
					isAdminByTeamID[team.Id] = true
				} else {
					explicitRoles = append(explicitRoles, role)
				}
			}
			rolesByTeamID[team.Id] = strings.Join(explicitRoles, " ")
		}

		member := &model.TeamMember{
			TeamId:      team.Id,
			UserId:      user.Id,
			SchemeGuest: user.IsGuest(),
			SchemeUser:  !user.IsGuest(),
			SchemeAdmin: team.Email == user.Email && !user.IsGuest(),
			CreateAt:    model.GetMillis(),
		}
		if !user.IsGuest() {
			var userShouldBeAdmin bool
			userShouldBeAdmin, appErr = a.UserIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
			if appErr != nil {
				return appErr
			}
			member.SchemeAdmin = userShouldBeAdmin
		}

		if tdata.Channels != nil {
			channels[team.Id] = append(channels[team.Id], *tdata.Channels...)
		}
		if !user.IsGuest() {
			channels[team.Id] = append(channels[team.Id], imports.UserChannelImportData{Name: model.NewPointer(model.DefaultChannelName)})
		}

		teamsByID[team.Id] = team
		teamMemberByTeamID[team.Id] = member
		if _, ok := existingMembershipsByTeamId[team.Id]; !ok {
			newTeamMembers = append(newTeamMembers, member)
		} else {
			oldTeamMembers = append(oldTeamMembers, member)
		}
	}

	oldMembers, nErr := a.Srv().Store().Team().UpdateMultipleMembers(oldTeamMembers)
	if nErr != nil {
		switch {
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("importUserTeams", "app.team.save_member.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	newMembers := []*model.TeamMember{}
	if len(newTeamMembers) > 0 {
		var nErr error
		newMembers, nErr = a.Srv().Store().Team().SaveMultipleMembers(newTeamMembers, *a.Config().TeamSettings.MaxUsersPerTeam)
		if nErr != nil {
			var conflictErr *store.ErrConflict
			var limitExceededErr *store.ErrLimitExceeded
			switch {
			case errors.As(nErr, &appErr): // in case we haven't converted to plain error.
				return appErr
			case errors.As(nErr, &conflictErr):
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_members.conflict.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case errors.As(nErr, &limitExceededErr):
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_members.max_accounts.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			default: // last fallback in case it doesn't map to an existing app error.
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_members.error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}

	for _, member := range append(newMembers, oldMembers...) {
		if member.ExplicitRoles != rolesByTeamID[member.TeamId] {
			if _, appErr = a.UpdateTeamMemberRoles(rctx, member.TeamId, user.Id, rolesByTeamID[member.TeamId]); appErr != nil {
				return appErr
			}
		}

		if _, appErr := a.UpdateTeamMemberSchemeRoles(rctx, member.TeamId, user.Id, isGuestByTeamID[member.TeamId], isUserByTeamId[member.TeamId], isAdminByTeamID[member.TeamId]); appErr != nil {
			rctx.Logger().Warn("Error updating team member scheme roles", mlog.String("team_id", member.TeamId), mlog.String("user_id", user.Id), mlog.Err(appErr))
		}
	}

	for _, team := range allTeams {
		if len(teamThemePreferencesByID[team.Id]) > 0 {
			pref := teamThemePreferencesByID[team.Id]
			if err := a.Srv().Store().Preference().Save(pref); err != nil {
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_preferences.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		channelsToImport := channels[team.Id]
		if err := a.importUserChannels(rctx, user, team, &channelsToImport); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) importUserChannels(rctx request.CTX, user *model.User, team *model.Team, data *[]imports.UserChannelImportData) *model.AppError {
	if data == nil {
		return nil
	}

	channelNames := []string{}
	for _, tdata := range *data {
		channelNames = append(channelNames, *tdata.Name)
	}
	allChannels, err := a.getChannelsByNames(channelNames, team.Id)
	if err != nil {
		return err
	}

	var (
		channelsByID             = map[string]*model.Channel{}
		channelMemberByChannelID = map[string]*model.ChannelMember{}
		newChannelMembers        = []*model.ChannelMember{}
		oldChannelMembers        = []*model.ChannelMember{}
		rolesByChannelId         = map[string]string{}
		channelPreferencesByID   = map[string]model.Preferences{}
		isGuestByChannelId       = map[string]bool{}
		isUserByChannelId        = map[string]bool{}
		isAdminByChannelId       = map[string]bool{}
	)

	existingMemberships, nErr := a.Srv().Store().Channel().GetMembersForUser(team.Id, user.Id)
	if nErr != nil {
		return model.NewAppError("importUserChannels", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	existingMembershipsByChannelId := map[string]model.ChannelMember{}
	for _, channelMembership := range existingMemberships {
		existingMembershipsByChannelId[channelMembership.ChannelId] = channelMembership
	}
	for _, cdata := range *data {
		channel, ok := allChannels[strings.ToLower(*cdata.Name)]
		if !ok {
			return model.NewAppError("BulkImport", "app.import.import_user_channels.channel_not_found.error", nil, "", http.StatusInternalServerError)
		}
		if _, ok = channelsByID[channel.Id]; ok && *cdata.Name == model.DefaultChannelName {
			// town-square membership was in the import and added by the importer (skip the added by the importer)
			continue
		}

		isGuestByChannelId[channel.Id] = false
		isUserByChannelId[channel.Id] = true
		isAdminByChannelId[channel.Id] = false

		if cdata.Roles != nil {
			rawRoles := *cdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.ChannelGuestRoleId {
					isGuestByChannelId[channel.Id] = true
					isUserByChannelId[channel.Id] = false
				} else if role == model.ChannelUserRoleId {
					isUserByChannelId[channel.Id] = true
				} else if role == model.ChannelAdminRoleId {
					isAdminByChannelId[channel.Id] = true
				} else {
					explicitRoles = append(explicitRoles, role)
				}
			}
			rolesByChannelId[channel.Id] = strings.Join(explicitRoles, " ")
		}

		if cdata.Favorite != nil && *cdata.Favorite {
			channelPreferencesByID[channel.Id] = append(channelPreferencesByID[channel.Id], model.Preference{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			})
		}

		member := &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: user.IsGuest(),
			SchemeUser:  !user.IsGuest(),
			SchemeAdmin: false,
		}
		if !user.IsGuest() {
			var userShouldBeAdmin bool
			userShouldBeAdmin, err = a.UserIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
			if err != nil {
				return err
			}
			member.SchemeAdmin = userShouldBeAdmin
		}

		if cdata.MentionCount != nil && cdata.MentionCountRoot != nil {
			member.MentionCount = *cdata.MentionCount
			member.MentionCountRoot = *cdata.MentionCountRoot
		}
		if cdata.UrgentMentionCount != nil {
			member.UrgentMentionCount = *cdata.UrgentMentionCount
		}
		if cdata.MsgCount != nil && cdata.MsgCountRoot != nil {
			member.MsgCount = *cdata.MsgCount
			member.MsgCountRoot = *cdata.MsgCountRoot
		}
		if cdata.LastViewedAt != nil {
			member.LastViewedAt = *cdata.LastViewedAt
		}

		if cdata.NotifyProps != nil {
			if cdata.NotifyProps.Desktop != nil {
				member.NotifyProps[model.DesktopNotifyProp] = *cdata.NotifyProps.Desktop
			}

			if cdata.NotifyProps.Mobile != nil {
				member.NotifyProps[model.PushNotifyProp] = *cdata.NotifyProps.Mobile
			}

			if cdata.NotifyProps.MarkUnread != nil {
				member.NotifyProps[model.MarkUnreadNotifyProp] = *cdata.NotifyProps.MarkUnread
			}
		}

		channelsByID[channel.Id] = channel
		channelMemberByChannelID[channel.Id] = member
		if _, ok := existingMembershipsByChannelId[channel.Id]; !ok {
			newChannelMembers = append(newChannelMembers, member)
		} else {
			oldChannelMembers = append(oldChannelMembers, member)
		}
	}

	oldMembers, nErr := a.Srv().Store().Channel().UpdateMultipleMembers(oldChannelMembers)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return appErr
		case errors.As(nErr, &nfErr):
			return model.NewAppError("importUserChannels", MissingChannelMemberError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return model.NewAppError("importUserChannels", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	newMembers := []*model.ChannelMember{}
	if len(newChannelMembers) > 0 {
		newMembers, nErr = a.Srv().Store().Channel().SaveMultipleMembers(newChannelMembers)
		if nErr != nil {
			var cErr *store.ErrConflict
			var appErr *model.AppError
			switch {
			case errors.As(nErr, &cErr):
				switch cErr.Resource {
				case "ChannelMembers":
					return model.NewAppError("importUserChannels", "app.channel.save_member.exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
				}
			case errors.As(nErr, &appErr):
				return appErr
			default:
				return model.NewAppError("importUserChannels", "app.channel.create_direct_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}

	for _, member := range append(newMembers, oldMembers...) {
		if member.ExplicitRoles != rolesByChannelId[member.ChannelId] {
			if _, err = a.UpdateChannelMemberRoles(rctx, member.ChannelId, user.Id, rolesByChannelId[member.ChannelId]); err != nil {
				return err
			}
		}

		if _, appErr := a.UpdateChannelMemberSchemeRoles(rctx, member.ChannelId, user.Id, isGuestByChannelId[member.ChannelId], isUserByChannelId[member.ChannelId], isAdminByChannelId[member.ChannelId]); appErr != nil {
			rctx.Logger().Warn("Error updating channel member scheme roles", mlog.String("channel_id", member.ChannelId), mlog.String("user_id", user.Id), mlog.Err(appErr))
		}
	}

	for _, channel := range allChannels {
		if len(channelPreferencesByID[channel.Id]) > 0 {
			pref := channelPreferencesByID[channel.Id]
			if err := a.Srv().Store().Preference().Save(pref); err != nil {
				return model.NewAppError("BulkImport", "app.import.import_user_channels.save_preferences.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	return nil
}

func (a *App) importReaction(data *imports.ReactionImportData, post *model.Post) *model.AppError {
	if err := imports.ValidateReactionImportData(data, post.CreateAt); err != nil {
		return err
	}

	var user *model.User
	var nErr error
	if user, nErr = a.Srv().Store().User().GetByUsername(*data.User); nErr != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]any{"Username": data.User}, "", http.StatusBadRequest).Wrap(nErr)
	}

	reaction := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: *data.EmojiName,
		CreateAt:  *data.CreateAt,
	}
	if _, nErr = a.Srv().Store().Reaction().Save(reaction); nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("importReaction", "app.reaction.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return nil
}

func (a *App) importReplies(rctx request.CTX, data []imports.ReplyImportData, post *model.Post, teamID string, extractContent bool) *model.AppError {
	var err *model.AppError
	usernames := []string{}
	for _, replyData := range data {
		replyData := replyData
		if err = imports.ValidateReplyImportData(&replyData, post.CreateAt, a.MaxPostSize()); err != nil {
			return err
		}
		usernames = append(usernames, *replyData.User)
		if replyData.FlaggedBy != nil {
			usernames = append(usernames, *replyData.FlaggedBy...)
		}
	}

	users, err := a.getUsersByUsernames(usernames)
	if err != nil {
		return err
	}

	type postAndReactions struct {
		post      *model.Post
		reactions *[]imports.ReactionImportData
	}

	var (
		postsWithData         = []postAndData{}
		postsForCreateList    = []*model.Post{}
		postsForOverwriteList = []*model.Post{}
		reactionsForCreateMap = make(map[string]postAndReactions)
		interimReactionsMap   = map[int64]*[]imports.ReactionImportData{}
	)

	for _, replyData := range data {
		replyData := replyData
		user := users[strings.ToLower(*replyData.User)]

		// Check if this post already exists.
		replies, nErr := a.Srv().Store().Post().GetPostsCreatedAt(post.ChannelId, *replyData.CreateAt)
		if nErr != nil {
			return model.NewAppError("importReplies", "app.post.get_posts_created_at.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		var reply *model.Post
		for _, r := range replies {
			if r.Message == *replyData.Message && r.RootId == post.Id {
				reply = r
				break
			}
		}

		if reply == nil {
			reply = &model.Post{}
		}
		reply.UserId = user.Id
		reply.ChannelId = post.ChannelId
		reply.RootId = post.Id
		reply.Message = *replyData.Message
		reply.CreateAt = *replyData.CreateAt
		if reply.CreateAt < post.CreateAt {
			rctx.Logger().Warn("Reply CreateAt is before parent post CreateAt, setting it to parent post CreateAt", mlog.Int("reply_create_at", reply.CreateAt), mlog.Int("parent_create_at", post.CreateAt))
			reply.CreateAt = post.CreateAt
		}
		if replyData.Props != nil {
			reply.Props = *replyData.Props
		}
		if replyData.Type != nil {
			reply.Type = *replyData.Type
		}
		if replyData.EditAt != nil {
			reply.EditAt = *replyData.EditAt
		}
		if replyData.IsPinned != nil {
			reply.IsPinned = *replyData.IsPinned
		}

		fileIDs := a.uploadAttachments(rctx, replyData.Attachments, reply, teamID, extractContent)
		for _, fileID := range reply.FileIds {
			if _, ok := fileIDs[fileID]; !ok {
				if err := a.Srv().Store().FileInfo().PermanentDelete(rctx, fileID); err != nil {
					rctx.Logger().Warn("Error while permanently deleting file info", mlog.String("file_id", fileID), mlog.Err(err))
				}
			}
		}
		reply.FileIds = make([]string, 0)
		for fileID := range fileIDs {
			reply.FileIds = append(reply.FileIds, fileID)
		}

		if reply.Id == "" {
			postsForCreateList = append(postsForCreateList, reply)
			if replyData.Reactions != nil && len(*replyData.Reactions) > 0 {
				// although createAt is not unique, I think it is safe to
				// assume that it could be near-unique especially for the same thread.
				// If this assumption fails, the last reactions would be used for the
				// posts that share same createAt value.
				interimReactionsMap[reply.CreateAt] = replyData.Reactions
			}
		} else {
			postsForOverwriteList = append(postsForOverwriteList, reply)
			if replyData.Reactions != nil && len(*replyData.Reactions) > 0 {
				reactionsForCreateMap[reply.Id] = postAndReactions{post: reply, reactions: replyData.Reactions}
			}
		}
		postsWithData = append(postsWithData, postAndData{post: reply, replyData: &replyData})
	}

	if len(postsForCreateList) > 0 {
		postsCreated, _, err := a.Srv().Store().Post().SaveMultiple(rctx, postsForCreateList)
		if err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &appErr):
				return appErr
			case errors.As(err, &invErr):
				return model.NewAppError("importReplies", "app.post.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			default:
				return model.NewAppError("importReplies", "app.post.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		for _, created := range postsCreated {
			reactions, ok := interimReactionsMap[created.CreateAt]
			if !ok || reactions == nil {
				continue
			}

			reactionsForCreateMap[created.Id] = postAndReactions{post: created, reactions: reactions}
		}
	}

	if _, _, nErr := a.Srv().Store().Post().OverwriteMultiple(rctx, postsForOverwriteList); nErr != nil {
		return model.NewAppError("importReplies", "app.post.overwrite.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, postAndReactions := range reactionsForCreateMap {
		for _, reaction := range *postAndReactions.reactions {
			if err := a.importReaction(&reaction, postAndReactions.post); err != nil {
				return err
			}
		}
	}

	for _, postWithData := range postsWithData {
		a.updateFileInfoWithPostId(rctx, postWithData.post)

		if postWithData.replyData.FlaggedBy != nil {
			var preferences model.Preferences

			for _, username := range *postWithData.replyData.FlaggedBy {
				user := users[strings.ToLower(username)]

				preferences = append(preferences, model.Preference{
					UserId:   user.Id,
					Category: model.PreferenceCategoryFlaggedPost,
					Name:     postWithData.post.Id,
					Value:    "true",
				})
			}

			if len(preferences) > 0 {
				if err := a.Srv().Store().Preference().Save(preferences); err != nil {
					return model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
			}
		}
	}

	return nil
}

func compareFilesContent(fileA, fileB io.Reader, bufSize int64) (bool, error) {
	aHash := sha256.New()
	bHash := sha256.New()

	if bufSize == 0 {
		// This buffer size was selected after some extensive benchmarking
		// (BenchmarkCompareFilesContent) and it showed to provide
		// a good compromise between processing speed and allocated memory,
		// especially in the common case of the readers being part of an S3 stored ZIP file.
		// See https://github.com/mattermost/mattermost/pull/26629 for full context.
		bufSize = 1024 * 1024 * 2 // 2MB
	}

	var nA, nB int64
	var errA, errB error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		var buf []byte
		// If the reader has a WriteTo method (e.g. *os.File)
		// we can avoid the buffer allocation.
		if _, ok := fileA.(io.WriterTo); !ok {
			buf = make([]byte, bufSize)
		}
		nA, errA = io.CopyBuffer(aHash, fileA, buf)
	}()
	go func() {
		defer wg.Done()
		var buf []byte
		// If the reader has a WriteTo method (e.g. *os.File)
		// we can avoid the buffer allocation.
		if _, ok := fileA.(io.WriterTo); !ok {
			buf = make([]byte, bufSize)
		}
		nB, errB = io.CopyBuffer(bHash, fileB, buf)
	}()
	wg.Wait()

	if errA != nil {
		return false, fmt.Errorf("failed to compare files: %w", errA)
	}

	if errB != nil {
		return false, fmt.Errorf("failed to compare files: %w", errB)
	}

	if nA != nB {
		return false, fmt.Errorf("size mismatch: %d != %d", nA, nB)
	}

	return bytes.Equal(aHash.Sum(nil), bHash.Sum(nil)), nil
}

func (a *App) importAttachment(rctx request.CTX, data *imports.AttachmentImportData, post *model.Post, teamID string, extractContent bool) (*model.FileInfo, *model.AppError) {
	var (
		name     string
		file     io.ReadCloser
		fileSize int64
	)
	if data.Data != nil {
		zipFile, err := data.Data.Open()
		if err != nil {
			return nil, model.NewAppError("BulkImport", "app.import.attachment.bad_file.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(err)
		}
		defer zipFile.Close()
		name = data.Data.Name
		fileSize = int64(data.Data.UncompressedSize64)
		file = zipFile

		rctx.Logger().Info("Preparing file upload from ZIP", mlog.String("file_name", name), mlog.Uint("file_size", data.Data.UncompressedSize64))
	} else {
		realFile, err := os.Open(*data.Path)
		if err != nil {
			return nil, model.NewAppError("BulkImport", "app.import.attachment.bad_file.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(err)
		}
		defer realFile.Close()
		name = realFile.Name()
		file = realFile

		info, err := realFile.Stat()
		if err != nil {
			return nil, model.NewAppError("BulkImport", "app.import.attachment.file_stat.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(err)
		}
		fileSize = info.Size()

		rctx.Logger().Info("Preparing file upload from file system", mlog.String("file_name", name), mlog.Int("file_size", info.Size()))
	}

	timestamp := utils.TimeFromMillis(post.CreateAt)

	// Go over existing files in the post and see if there already exists a file with the same name, size and hash. If so - skip it
	if post.Id != "" {
		oldFiles, err := a.Srv().Store().FileInfo().GetForPost(post.Id, true, false, true)
		if err != nil {
			return nil, model.NewAppError("BulkImport", "app.import.attachment.file_upload.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(err)
		}
		for _, oldFile := range oldFiles {
			if oldFile.Name != path.Base(name) || oldFile.Size != fileSize {
				continue
			}

			oldFileReader, appErr := a.FileReader(oldFile.Path)
			if appErr != nil {
				return nil, model.NewAppError("BulkImport", "app.import.attachment.file_upload.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(appErr)
			}
			defer oldFileReader.Close()

			if ok, err := compareFilesContent(oldFileReader, file, 0); err != nil {
				rctx.Logger().Error("Failed to compare files content", mlog.String("file_name", name), mlog.Err(err))
			} else if ok {
				rctx.Logger().Info("Skipping uploading of file because name already exists and content matches", mlog.String("file_name", name))
				return oldFile, nil
			}

			rctx.Logger().Info("File contents don't match, will re-upload", mlog.String("file_name", name))

			// Since compareFilesContent needs to read the whole file we need to
			// either seek back (local file) or re-open it (zip file).
			if f, ok := file.(*os.File); ok {
				rctx.Logger().Info("File is *os.File, can seek", mlog.String("file_name", name))
				if _, err := f.Seek(0, io.SeekStart); err != nil {
					return nil, model.NewAppError("BulkImport", "app.import.attachment.seek_file.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(err)
				}
			} else if data.Data != nil {
				rctx.Logger().Info("File is from ZIP, can't seek, opening again", mlog.String("file_name", name))
				if err := file.Close(); err != nil {
					rctx.Logger().Warn("Error closing file", mlog.String("file_name", name), mlog.Err(err))
				}

				f, err := data.Data.Open()
				if err != nil {
					return nil, model.NewAppError("BulkImport", "app.import.attachment.bad_file.error", map[string]any{"FilePath": *data.Path}, "", http.StatusBadRequest).Wrap(err)
				}
				defer func() {
					if err := f.Close(); err != nil {
						rctx.Logger().Warn("Error closing zip file reader", mlog.String("file_name", name), mlog.Err(err))
					}
				}()

				file = f
			}

			break
		}
	}

	rctx.Logger().Info("Uploading file with name", mlog.String("file_name", name))

	fileInfo, appErr := a.UploadFileX(rctx, post.ChannelId, name, file,
		UploadFileSetTeamId(teamID),
		UploadFileSetUserId(post.UserId),
		UploadFileSetTimestamp(timestamp),
		UploadFileSetContentLength(fileSize),
		UploadFileSetExtractContent(extractContent),
	)
	if appErr != nil {
		rctx.Logger().Error("Failed to upload file", mlog.Err(appErr), mlog.String("file_name", name))
		return nil, appErr
	}

	return fileInfo, nil
}

type postAndData struct {
	post           *model.Post
	postData       *imports.PostImportData
	directPostData *imports.DirectPostImportData
	replyData      *imports.ReplyImportData
	team           *model.Team
	lineNumber     int
}

func (a *App) getUsersByUsernames(usernames []string) (map[string]*model.User, *model.AppError) {
	uniqueUsernames := utils.RemoveDuplicatesFromStringArray(usernames)
	allUsers, err := a.Srv().Store().User().GetProfilesByUsernames(uniqueUsernames, nil)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.get_users_by_username.some_users_not_found.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if len(allUsers) != len(uniqueUsernames) {
		return nil, model.NewAppError("BulkImport", "app.import.get_users_by_username.some_users_not_found.error", nil, "", http.StatusBadRequest)
	}

	users := make(map[string]*model.User)
	for _, user := range allUsers {
		users[strings.ToLower(user.Username)] = user
	}
	return users, nil
}

func (a *App) getTeamsByNames(names []string) (map[string]*model.Team, *model.AppError) {
	allTeams, err := a.Srv().Store().Team().GetByNames(names)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.get_teams_by_names.some_teams_not_found.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	teams := make(map[string]*model.Team)
	for _, team := range allTeams {
		teams[strings.ToLower(team.Name)] = team
	}
	return teams, nil
}

func (a *App) getChannelsByNames(names []string, teamID string) (map[string]*model.Channel, *model.AppError) {
	allChannels, err := a.Srv().Store().Channel().GetByNamesIncludeDeleted(teamID, names, true)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.get_teams_by_names.some_teams_not_found.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	channels := make(map[string]*model.Channel)
	for _, channel := range allChannels {
		channels[strings.ToLower(channel.Name)] = channel
	}
	return channels, nil
}

// getChannelsForPosts returns map[teamName]map[channelName]*model.Channel
func (a *App) getChannelsForPosts(teams map[string]*model.Team, data []*imports.PostImportData) (map[string]map[string]*model.Channel, *model.AppError) {
	teamChannels := make(map[string]map[string]*model.Channel)
	for _, postData := range data {
		teamName := strings.ToLower(*postData.Team)
		if _, ok := teamChannels[teamName]; !ok {
			teamChannels[teamName] = make(map[string]*model.Channel)
		}
		channelName := strings.ToLower(*postData.Channel)
		if channel, ok := teamChannels[teamName][channelName]; !ok || channel == nil {
			var err error
			channel, err = a.Srv().Store().Channel().GetByNameIncludeDeleted(teams[teamName].Id, *postData.Channel, true)
			if err != nil {
				return nil, model.NewAppError("BulkImport", "app.import.import_post.channel_not_found.error", map[string]any{"ChannelName": *postData.Channel}, "", http.StatusBadRequest).Wrap(err)
			}
			teamChannels[teamName][channelName] = channel
		}
	}
	return teamChannels, nil
}

// getPostStrID returns a string ID composed of several post fields to
// uniquely identify a post before it's imported, so it has no ID yet
func getPostStrID(post *model.Post) string {
	return fmt.Sprintf("%d%s%s", post.CreateAt, post.ChannelId, post.Message)
}

// importMultiplePostLines will return an error and the line that
// caused it whenever possible
func (a *App) importMultiplePostLines(rctx request.CTX, lines []imports.LineImportWorkerData, dryRun, extractContent bool) (int, *model.AppError) {
	if len(lines) == 0 {
		return 0, nil
	}

	rctx.Logger().Info("Validating post lines", mlog.Int("count", len(lines)), mlog.Int("first_line", lines[0].LineNumber))

	for _, line := range lines {
		if err := imports.ValidatePostImportData(line.Post, a.MaxPostSize()); err != nil {
			return line.LineNumber, err
		}
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return 0, nil
	}

	rctx.Logger().Info("Importing post lines", mlog.Int("count", len(lines)), mlog.Int("first_line", lines[0].LineNumber))

	usernames := []string{}
	teamNames := make([]string, len(lines))
	postsData := make([]*imports.PostImportData, len(lines))
	for i, line := range lines {
		usernames = append(usernames, *line.Post.User)
		if line.Post.FlaggedBy != nil {
			usernames = append(usernames, *line.Post.FlaggedBy...)
		}
		teamNames[i] = *line.Post.Team
		postsData[i] = line.Post
	}

	users, err := a.getUsersByUsernames(usernames)
	if err != nil {
		return 0, err
	}

	teams, err := a.getTeamsByNames(teamNames)
	if err != nil {
		return 0, err
	}

	channels, err := a.getChannelsForPosts(teams, postsData)
	if err != nil {
		return 0, err
	}

	var (
		postsWithData                = []postAndData{}
		postsForCreateList           = []*model.Post{}
		postsForCreateMap            = map[string]int{}
		postsForOverwriteList        = []*model.Post{}
		postsForOverwriteMap         = map[string]int{}
		threadMembersToCreateMap     = map[string][]*model.ThreadMembership{}
		threadMembersToOverwriteList = []*model.ThreadMembership{}
	)

	for _, line := range lines {
		team := teams[strings.ToLower(*line.Post.Team)]
		channel := channels[*line.Post.Team][*line.Post.Channel]
		user := users[strings.ToLower(*line.Post.User)]

		// Check if this post already exists.
		posts, nErr := a.Srv().Store().Post().GetPostsCreatedAt(channel.Id, *line.Post.CreateAt)
		if nErr != nil {
			return line.LineNumber, model.NewAppError("importMultiplePostLines", "app.post.get_posts_created_at.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		var post *model.Post
		for _, p := range posts {
			if p.Message == *line.Post.Message {
				post = p
				break
			}
		}

		if post == nil {
			post = &model.Post{}
		}

		post.ChannelId = channel.Id
		post.Message = *line.Post.Message
		post.UserId = user.Id
		post.CreateAt = *line.Post.CreateAt
		post.Hashtags, _ = model.ParseHashtags(post.Message)

		if line.Post.Type != nil {
			post.Type = *line.Post.Type
		}
		if line.Post.EditAt != nil {
			post.EditAt = *line.Post.EditAt
		}
		if line.Post.Props != nil {
			post.Props = *line.Post.Props
		}
		if line.Post.IsPinned != nil {
			post.IsPinned = *line.Post.IsPinned
		}
		if line.Post.ThreadFollowers != nil {
			threadMemberships, lineNumber, err := a.extractThreadMembers(&line, users, post)
			if err != nil {
				return lineNumber, err
			}

			if post.Id == "" {
				threadMembersToCreateMap[getPostStrID(post)] = threadMemberships
			} else {
				threadMembersToOverwriteList = append(threadMembersToOverwriteList, threadMemberships...)
			}
		}

		fileIDs := a.uploadAttachments(rctx, line.Post.Attachments, post, team.Id, extractContent)
		for _, fileID := range post.FileIds {
			if _, ok := fileIDs[fileID]; !ok {
				if err := a.Srv().Store().FileInfo().PermanentDelete(rctx, fileID); err != nil {
					rctx.Logger().Warn("Error while permanently deleting file info", mlog.String("file_id", fileID), mlog.Err(err))
				}
			}
		}
		post.FileIds = make([]string, 0)
		for fileID := range fileIDs {
			post.FileIds = append(post.FileIds, fileID)
		}

		if post.Id == "" {
			postsForCreateList = append(postsForCreateList, post)
			postsForCreateMap[getPostStrID(post)] = line.LineNumber
		} else {
			postsForOverwriteList = append(postsForOverwriteList, post)
			postsForOverwriteMap[getPostStrID(post)] = line.LineNumber
		}
		// Tip: the post ID is getting populated after the post is saved, if it's a new post. Otherwise, it's already set.
		postsWithData = append(postsWithData, postAndData{post: post, postData: line.Post, team: team, lineNumber: line.LineNumber})
	}

	if len(postsForCreateList) > 0 {
		_, idx, nErr := a.Srv().Store().Post().SaveMultiple(rctx, postsForCreateList)
		if nErr != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			var retErr *model.AppError
			switch {
			case errors.As(nErr, &appErr):
				retErr = appErr
			case errors.As(nErr, &invErr):
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			default:
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			if idx != -1 && idx < len(postsForCreateList) {
				post := postsForCreateList[idx]
				if lineNumber, ok := postsForCreateMap[getPostStrID(post)]; ok {
					return lineNumber, retErr
				}
			}
			return 0, retErr
		}

		var membersToCreate []*model.ThreadMembership
		for _, post := range postsForCreateList {
			members, ok := threadMembersToCreateMap[getPostStrID(post)]
			if !ok {
				continue
			}

			for _, member := range members {
				if post.Id == "" {
					appErr := model.NewAppError("importMultiplePostLines", "app.post.save.thread_membership.app_error", nil, "", http.StatusInternalServerError).Wrap(errors.New("post id cannot be empty"))
					if lineNumber, ok := postsForCreateMap[getPostStrID(post)]; ok {
						return lineNumber, appErr
					}
					return 0, appErr
				}
				member.PostId = post.Id
			}

			membersToCreate = append(membersToCreate, members...)
		}

		// we have an assumption here is that all these memberships should be brand new because the corresponding posts
		// do not exist in the target until the import.
		if _, err := a.Srv().Store().Thread().SaveMultipleMemberships(membersToCreate); err != nil {
			// we don't know the line number of the post that caused the error
			// so we return 0. But at this stage, it's unlikely to receive an error
			// due to the thread member itself, most likely it's due to the DB connection etc.
			return 0, model.NewAppError("importMultiplePostLines", "app.post.save.thread_membership.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if _, idx, err := a.Srv().Store().Post().OverwriteMultiple(rctx, postsForOverwriteList); err != nil {
		if idx != -1 && idx < len(postsForOverwriteList) {
			post := postsForOverwriteList[idx]
			if lineNumber, ok := postsForOverwriteMap[getPostStrID(post)]; ok {
				return lineNumber, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		return 0, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Update thread memberships for posts that were overwritten. Here some of the memberships
	// can be brand new, needs to be updated or an older membership should not get updated.
	// MaintainMembership method has some logic within to handle those decisions. Unfortunately
	// some application code leaked to the store layer here, which should be revisited when there
	// is resource (eg. time, human or maybe AI).
	if _, sErr := a.Srv().Store().Thread().MaintainMultipleFromImport(threadMembersToOverwriteList); sErr != nil {
		return 0, model.NewAppError("importMultiplePostLines", "app.post.save.thread_membership.app_error", nil, "", http.StatusInternalServerError).Wrap(sErr)
	}

	for _, postWithData := range postsWithData {
		postWithData := postWithData
		if postWithData.postData.FlaggedBy != nil {
			var preferences model.Preferences

			for _, username := range *postWithData.postData.FlaggedBy {
				user := users[strings.ToLower(username)]

				preferences = append(preferences, model.Preference{
					UserId:   user.Id,
					Category: model.PreferenceCategoryFlaggedPost,
					Name:     postWithData.post.Id,
					Value:    "true",
				})
			}

			if len(preferences) > 0 {
				if err := a.Srv().Store().Preference().Save(preferences); err != nil {
					return postWithData.lineNumber, model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
			}
		}

		if postWithData.postData.Reactions != nil {
			for _, reaction := range *postWithData.postData.Reactions {
				reaction := reaction
				if err := a.importReaction(&reaction, postWithData.post); err != nil {
					return postWithData.lineNumber, err
				}
			}
		}

		if postWithData.postData.Replies != nil && len(*postWithData.postData.Replies) > 0 {
			err := a.importReplies(rctx, *postWithData.postData.Replies, postWithData.post, postWithData.team.Id, extractContent)
			if err != nil {
				return postWithData.lineNumber, err
			}
		}
		a.updateFileInfoWithPostId(rctx, postWithData.post)
	}
	return 0, nil
}

// uploadAttachments imports new attachments and returns current attachments of the post as a map
func (a *App) uploadAttachments(rctx request.CTX, attachments *[]imports.AttachmentImportData, post *model.Post, teamID string, extractContent bool) map[string]bool {
	if attachments == nil {
		return nil
	}
	fileIDs := make(map[string]bool)
	for _, attachment := range *attachments {
		attachment := attachment
		fileInfo, err := a.importAttachment(rctx, &attachment, post, teamID, extractContent)
		if err != nil {
			if attachment.Path != nil {
				rctx.Logger().Warn(
					"failed to import attachment",
					mlog.String("path", *attachment.Path),
					mlog.String("error", err.Error()))
			} else {
				rctx.Logger().Warn("failed to import attachment; path was nil",
					mlog.String("error", err.Error()))
			}
			continue
		}
		fileIDs[fileInfo.Id] = true
	}
	return fileIDs
}

func (a *App) updateFileInfoWithPostId(rctx request.CTX, post *model.Post) {
	for _, fileID := range post.FileIds {
		if err := a.Srv().Store().FileInfo().AttachToPost(rctx, fileID, post.Id, post.ChannelId, post.UserId); err != nil {
			rctx.Logger().Error("Error attaching files to post.", mlog.String("post_id", post.Id), mlog.Array("post_file_ids", post.FileIds), mlog.Err(err))
		}
	}
}
func (a *App) importDirectChannel(rctx request.CTX, data *imports.DirectChannelImportData, dryRun bool) *model.AppError {
	var err *model.AppError
	if err = imports.ValidateDirectChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var members []string
	if data.Participants != nil {
		members = make([]string, len(data.Participants))
		for i, member := range data.Participants {
			members[i] = *member.Username
		}
	} else if data.Members != nil {
		members = make([]string, len(*data.Members))
		copy(members, *data.Members)
	} else {
		return model.NewAppError("BulkImport", "app.import.import_direct_channel.no_members.error", nil, "", http.StatusBadRequest)
	}

	var userIDs []string
	userMap, err := a.getUsersByUsernames(members)
	if err != nil {
		return err
	}
	for _, user := range members {
		userIDs = append(userIDs, userMap[strings.ToLower(user)].Id)
	}

	var channel *model.Channel

	if len(userIDs) == 2 {
		ch, err2 := a.createDirectChannel(rctx, userIDs[0], userIDs[1])
		if err2 != nil && err2.Id != store.ChannelExistsError {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_direct_channel.error", nil, "", http.StatusBadRequest).Wrap(err2)
		}
		channel = ch
	} else {
		ch, err2 := a.createGroupChannel(rctx, userIDs)
		if err2 != nil && err2.Id != store.ChannelExistsError {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_group_channel.error", nil, "", http.StatusBadRequest).Wrap(err2)
		}
		channel = ch
	}

	totalMembers, err := a.GetChannelMemberCount(rctx, channel.Id)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_direct_channel.get_channel_members.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var ems = make([]model.ChannelMember, 0, totalMembers)
	var page int

	for int64(len(ems)) < totalMembers {
		res, err := a.GetChannelMembersPage(rctx, channel.Id, page, 100)
		if err != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.get_channel_members.error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		ems = append(ems, res...)
		page++
	}

	existingMembers := make(map[string]model.ChannelMember)
	for _, member := range ems {
		existingMembers[member.UserId] = member
	}

	newChannelMembers := make([]*model.ChannelMember, 0)
	for _, member := range data.Participants {
		m := &model.ChannelMember{
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}
		if member.LastViewedAt != nil {
			m.LastViewedAt = *member.LastViewedAt
		}
		if member.MsgCount != nil {
			m.MsgCount = *member.MsgCount
		}
		if member.MentionCount != nil {
			m.MentionCount = *member.MentionCount
		}
		if member.MentionCountRoot != nil {
			m.MentionCountRoot = *member.MentionCountRoot
		}
		if member.UrgentMentionCount != nil {
			m.UrgentMentionCount = *member.UrgentMentionCount
		}
		if member.MsgCountRoot != nil {
			m.MsgCountRoot = *member.MsgCountRoot
		}
		if member.SchemeUser != nil {
			m.SchemeUser = *member.SchemeUser
		}
		if member.SchemeAdmin != nil {
			m.SchemeAdmin = *member.SchemeAdmin
		}
		if member.SchemeGuest != nil {
			m.SchemeGuest = *member.SchemeGuest
		}

		if member.NotifyProps != nil {
			if member.NotifyProps.Desktop != nil {
				if value, ok := m.NotifyProps[model.DesktopNotifyProp]; !ok || value != *member.NotifyProps.Desktop {
					m.NotifyProps[model.DesktopNotifyProp] = *member.NotifyProps.Desktop
				}
			}

			if member.NotifyProps.MarkUnread != nil {
				if value, ok := m.NotifyProps[model.DesktopSoundNotifyProp]; !ok || value != *member.NotifyProps.MarkUnread {
					m.NotifyProps[model.MarkUnreadNotifyProp] = *member.NotifyProps.MarkUnread
				}
			}

			if member.NotifyProps.Mobile != nil {
				if value, ok := m.NotifyProps[model.PushNotifyProp]; !ok || value != *member.NotifyProps.Mobile {
					m.NotifyProps[model.PushNotifyProp] = *member.NotifyProps.Mobile
				}
			}

			if member.NotifyProps.Email != nil {
				if value, ok := m.NotifyProps[model.EmailNotifyProp]; !ok || value != *member.NotifyProps.Email {
					m.NotifyProps[model.EmailNotifyProp] = *member.NotifyProps.Email
				}
			}

			if member.NotifyProps.IgnoreChannelMentions != nil {
				if value, ok := m.NotifyProps[model.IgnoreChannelMentionsNotifyProp]; !ok || value != *member.NotifyProps.IgnoreChannelMentions {
					m.NotifyProps[model.IgnoreChannelMentionsNotifyProp] = *member.NotifyProps.IgnoreChannelMentions
				}
			}

			if member.NotifyProps.ChannelAutoFollowThreads != nil {
				if value, ok := m.NotifyProps[model.ChannelAutoFollowThreads]; !ok || value != *member.NotifyProps.ChannelAutoFollowThreads {
					m.NotifyProps[model.ChannelAutoFollowThreads] = *member.NotifyProps.ChannelAutoFollowThreads
				}
			}
		}

		u := userMap[strings.ToLower(*member.Username)]
		if existing, ok := existingMembers[u.Id]; ok {
			// Decide which membership is newer. We have LastViewedAt in the import data, which should
			// give us a good idea of which membership is newer.
			if existing.LastViewedAt > m.LastViewedAt {
				continue
			}
		}
		m.UserId = u.Id
		m.ChannelId = channel.Id
		newChannelMembers = append(newChannelMembers, m)
	}

	// the channel memberships are already created in the channel creation
	// we always going to update the channel memberships
	if len(newChannelMembers) > 0 {
		_, nErr := a.Srv().Store().Channel().UpdateMultipleMembers(newChannelMembers)
		if nErr != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_group_channel.error", nil, "", http.StatusBadRequest).Wrap(nErr)
		}
	}

	var preferences model.Preferences

	if data.ShownBy != nil {
		for _, username := range *data.ShownBy {
			switch channel.Type {
			case model.ChannelTypeDirect:
				otherUserId := userMap[strings.ToLower(username)].Id
				for uname, user := range userMap {
					if uname != username {
						otherUserId = user.Id
						break
					}
				}
				preferences = append(preferences, model.Preference{
					UserId:   userMap[strings.ToLower(username)].Id,
					Category: model.PreferenceCategoryDirectChannelShow,
					Name:     otherUserId,
					Value:    "true",
				})
			case model.ChannelTypeGroup:
				preferences = append(preferences, model.Preference{
					UserId:   userMap[strings.ToLower(username)].Id,
					Category: model.PreferenceCategoryGroupChannelShow,
					Name:     channel.Id,
					Value:    "true",
				})
			}
		}
	}

	if data.FavoritedBy != nil {
		for _, favoriter := range *data.FavoritedBy {
			preferences = append(preferences, model.Preference{
				UserId:   userMap[strings.ToLower(favoriter)].Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			})
		}
	}

	if len(preferences) > 0 {
		if err := a.Srv().Store().Preference().Save(preferences); err != nil {
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				appErr.StatusCode = http.StatusBadRequest
				return appErr
			default:
				return model.NewAppError("importDirectChannel", "app.preference.save.updating.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		}
	}

	if data.Header != nil {
		channel.Header = *data.Header
		if _, appErr := a.Srv().Store().Channel().Update(rctx, channel); appErr != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.update_header_failed.error", nil, "", http.StatusBadRequest).Wrap(appErr)
		}
	}

	return nil
}

// importMultipleDirectPostLines will return an error and the line
// that caused it whenever possible
func (a *App) importMultipleDirectPostLines(rctx request.CTX, lines []imports.LineImportWorkerData, dryRun, extractContent bool) (int, *model.AppError) {
	if len(lines) == 0 {
		return 0, nil
	}

	for _, line := range lines {
		if err := imports.ValidateDirectPostImportData(line.DirectPost, a.MaxPostSize()); err != nil {
			return line.LineNumber, err
		}
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return 0, nil
	}

	usernames := []string{}
	for _, line := range lines {
		usernames = append(usernames, *line.DirectPost.User)
		if line.DirectPost.FlaggedBy != nil {
			usernames = append(usernames, *line.DirectPost.FlaggedBy...)
		}
		usernames = append(usernames, *line.DirectPost.ChannelMembers...)
	}

	users, err := a.getUsersByUsernames(usernames)
	if err != nil {
		return 0, err
	}

	var (
		postsWithData                = []postAndData{}
		postsForCreateList           = []*model.Post{}
		postsForCreateMap            = map[string]int{}
		postsForOverwriteList        = []*model.Post{}
		postsForOverwriteMap         = map[string]int{}
		threadMembersToCreateMap     = map[string][]*model.ThreadMembership{}
		threadMembersToOverwriteList = []*model.ThreadMembership{}
	)

	for _, line := range lines {
		var userIDs []string
		var err *model.AppError
		for _, username := range *line.DirectPost.ChannelMembers {
			user := users[strings.ToLower(username)]
			userIDs = append(userIDs, user.Id)
		}

		var channel *model.Channel
		var ch *model.Channel
		if len(userIDs) == 2 {
			ch, err = a.GetOrCreateDirectChannel(rctx, userIDs[0], userIDs[1])
			if err != nil && err.Id != store.ChannelExistsError {
				return line.LineNumber, model.NewAppError("BulkImport", "app.import.import_direct_post.create_direct_channel.error", nil, "", http.StatusBadRequest).Wrap(err)
			}
			channel = ch
		} else if len(userIDs) > 2 {
			ch, err = a.createGroupChannel(rctx, userIDs)
			if err != nil && err.Id != store.ChannelExistsError {
				return line.LineNumber, model.NewAppError("BulkImport", "app.import.import_direct_post.create_group_channel.error", nil, "", http.StatusBadRequest).Wrap(err)
			}
			channel = ch
		} else {
			rctx.Logger().Warn("Not enough users to create a direct channel", mlog.Int("line_number", line.LineNumber))
			continue
		}

		user := users[strings.ToLower(*line.DirectPost.User)]

		// Check if this post already exists.
		posts, nErr := a.Srv().Store().Post().GetPostsCreatedAt(channel.Id, *line.DirectPost.CreateAt)
		if nErr != nil {
			return line.LineNumber, model.NewAppError("BulkImport", "app.post.get_posts_created_at.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		var post *model.Post
		for _, p := range posts {
			if p.Message == *line.DirectPost.Message {
				post = p
				break
			}
		}

		if post == nil {
			post = &model.Post{}
		}

		post.ChannelId = channel.Id
		post.Message = *line.DirectPost.Message
		post.UserId = user.Id
		post.CreateAt = *line.DirectPost.CreateAt
		post.Hashtags, _ = model.ParseHashtags(post.Message)

		if line.DirectPost.Type != nil {
			post.Type = *line.DirectPost.Type
		}
		if line.DirectPost.EditAt != nil {
			post.EditAt = *line.DirectPost.EditAt
		}
		if line.DirectPost.Props != nil {
			post.Props = *line.DirectPost.Props
		}
		if line.DirectPost.IsPinned != nil {
			post.IsPinned = *line.DirectPost.IsPinned
		}
		if line.DirectPost.ThreadFollowers != nil {
			threadMemberships, lineNumber, err := a.extractThreadMembers(&line, users, post)
			if err != nil {
				return lineNumber, err
			}

			if post.Id == "" {
				threadMembersToCreateMap[getPostStrID(post)] = threadMemberships
			} else {
				threadMembersToOverwriteList = append(threadMembersToOverwriteList, threadMemberships...)
			}
		}

		fileIDs := a.uploadAttachments(rctx, line.DirectPost.Attachments, post, "noteam", extractContent)
		for _, fileID := range post.FileIds {
			if _, ok := fileIDs[fileID]; !ok {
				if err := a.Srv().Store().FileInfo().PermanentDelete(rctx, fileID); err != nil {
					rctx.Logger().Warn("Error while permanently deleting file info", mlog.String("file_id", fileID), mlog.Err(err))
				}
			}
		}
		post.FileIds = make([]string, 0)
		for fileID := range fileIDs {
			post.FileIds = append(post.FileIds, fileID)
		}

		if post.Id == "" {
			postsForCreateList = append(postsForCreateList, post)
			postsForCreateMap[getPostStrID(post)] = line.LineNumber
		} else {
			postsForOverwriteList = append(postsForOverwriteList, post)
			postsForOverwriteMap[getPostStrID(post)] = line.LineNumber
		}
		postsWithData = append(postsWithData, postAndData{post: post, directPostData: line.DirectPost, lineNumber: line.LineNumber})
	}

	if len(postsForCreateList) > 0 {
		if _, idx, err := a.Srv().Store().Post().SaveMultiple(rctx, postsForCreateList); err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			var retErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				retErr = appErr
			case errors.As(err, &invErr):
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			default:
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			if idx != -1 && idx < len(postsForCreateList) {
				post := postsForCreateList[idx]
				if lineNumber, ok := postsForCreateMap[getPostStrID(post)]; ok {
					return lineNumber, retErr
				}
			}
			return 0, retErr
		}

		var membersToCreate []*model.ThreadMembership
		for _, post := range postsForCreateList {
			members, ok := threadMembersToCreateMap[getPostStrID(post)]
			if !ok {
				continue
			}

			for _, member := range members {
				if post.Id == "" {
					appErr := model.NewAppError("importMultiplePostLines", "app.post.save.thread_membership.app_error", nil, "", http.StatusInternalServerError).Wrap(errors.New("post id cannot be empty"))
					if lineNumber, ok := postsForCreateMap[getPostStrID(post)]; ok {
						return lineNumber, appErr
					}
					return 0, appErr
				}
				member.PostId = post.Id
			}

			membersToCreate = append(membersToCreate, members...)
		}

		if _, err := a.Srv().Store().Thread().SaveMultipleMemberships(membersToCreate); err != nil {
			return 0, model.NewAppError("importMultiplePostLines", "app.post.save.thread_membership.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if _, idx, err := a.Srv().Store().Post().OverwriteMultiple(rctx, postsForOverwriteList); err != nil {
		if idx != -1 && idx < len(postsForOverwriteList) {
			post := postsForOverwriteList[idx]
			if lineNumber, ok := postsForOverwriteMap[getPostStrID(post)]; ok {
				return lineNumber, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		return 0, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if _, sErr := a.Srv().Store().Thread().MaintainMultipleFromImport(threadMembersToOverwriteList); sErr != nil {
		return 0, model.NewAppError("importMultiplePostLines", "app.post.save.thread_membership.app_error", nil, "", http.StatusInternalServerError).Wrap(sErr)
	}

	for _, postWithData := range postsWithData {
		if postWithData.directPostData.FlaggedBy != nil {
			var preferences model.Preferences

			for _, username := range *postWithData.directPostData.FlaggedBy {
				user := users[strings.ToLower(username)]

				preferences = append(preferences, model.Preference{
					UserId:   user.Id,
					Category: model.PreferenceCategoryFlaggedPost,
					Name:     postWithData.post.Id,
					Value:    "true",
				})
			}

			if len(preferences) > 0 {
				if err := a.Srv().Store().Preference().Save(preferences); err != nil {
					return postWithData.lineNumber, model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
			}
		}

		if postWithData.directPostData.Reactions != nil {
			for _, reaction := range *postWithData.directPostData.Reactions {
				reaction := reaction
				if err := a.importReaction(&reaction, postWithData.post); err != nil {
					return postWithData.lineNumber, err
				}
			}
		}

		if postWithData.directPostData.Replies != nil {
			if err := a.importReplies(rctx, *postWithData.directPostData.Replies, postWithData.post, "noteam", extractContent); err != nil {
				return postWithData.lineNumber, err
			}
		}

		a.updateFileInfoWithPostId(rctx, postWithData.post)
	}
	return 0, nil
}

func (a *App) importEmoji(rctx request.CTX, data *imports.EmojiImportData, dryRun bool) *model.AppError {
	var fields []mlog.Field
	if data != nil && data.Name != nil {
		fields = append(fields, mlog.String("emoji_name", *data.Name))
	}
	rctx.Logger().Info("Validating emoji", fields...)

	aerr := imports.ValidateEmojiImportData(data)
	if aerr != nil {
		if aerr.Id == "model.emoji.system_emoji_name.app_error" {
			rctx.Logger().Warn("Skipping emoji import due to name conflict with system emoji", mlog.String("emoji_name", *data.Name))
			return nil
		}
		return aerr
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	rctx.Logger().Info("Importing emoji", fields...)

	var emoji *model.Emoji

	emoji, err := a.Srv().Store().Emoji().GetByName(rctx, *data.Name, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("importEmoji", "app.emoji.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	alreadyExists := emoji != nil

	if !alreadyExists {
		emoji = &model.Emoji{
			Name: *data.Name,
		}
		emoji.PreSave()
	}

	var file io.ReadCloser
	if data.Data != nil {
		file, err = data.Data.Open()
	} else {
		file, err = os.Open(*data.Image)
	}
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.emoji.bad_file.error", map[string]any{"EmojiName": *data.Name}, "", http.StatusBadRequest).Wrap(err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			rctx.Logger().Warn("Error closing emoji file", mlog.String("emoji_name", *data.Name), mlog.Err(err))
		}
	}()

	reader := utils.NewLimitedReaderWithError(file, MaxEmojiFileSize)
	if _, err := a.WriteFile(reader, getEmojiImagePath(emoji.Id)); err != nil {
		return err
	}

	if !alreadyExists {
		if _, err := a.Srv().Store().Emoji().Save(emoji); err != nil {
			return model.NewAppError("importEmoji", "api.emoji.create.internal_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	return nil
}

func (a *App) extractThreadMembers(line *imports.LineImportWorkerData, users map[string]*model.User, post *model.Post) ([]*model.ThreadMembership, int, *model.AppError) {
	threadMemberships := []*model.ThreadMembership{}

	var importedFollowers []imports.ThreadFollowerImportData
	if line.Post != nil {
		importedFollowers = *line.Post.ThreadFollowers
	} else if line.DirectPost != nil {
		importedFollowers = *line.DirectPost.ThreadFollowers
	}
	participants := make([]*model.User, len(importedFollowers))

	for i, member := range importedFollowers {
		user, ok := users[strings.ToLower(*member.User)]
		if !ok {
			// maybe it's a user on target instance but not in the import data.
			// This is a rare case, but we need to or can to handle it.
			// alternatively, we can continue and discard this follower as maybe they
			// were deleted.
			var uErr error
			user, uErr = a.Srv().Store().User().GetByUsername(*member.User)
			if uErr != nil {
				return nil, line.LineNumber, model.NewAppError("importMultiplePostLines", "app.import.get_users_by_username.some_users_not_found.error", nil, "", http.StatusBadRequest).Wrap(uErr)
			}
		}
		membership := &model.ThreadMembership{
			PostId:    post.Id, // empty if it's a new post, will set later while inserting to the DB.
			UserId:    user.Id,
			Following: true,
		}

		if member.LastViewed != nil {
			membership.LastViewed = *member.LastViewed
		}
		if member.UnreadMentions != nil {
			membership.UnreadMentions = *member.UnreadMentions
		}
		// We only need the user ID to update the thread.
		participants[i] = &model.User{Id: user.Id}
		threadMemberships = append(threadMemberships, membership)
	}
	post.Participants = participants

	return threadMemberships, 0, nil
}
