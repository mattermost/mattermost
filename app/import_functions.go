// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"crypto/sha1"
	"io"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

//
// -- Bulk Import Functions --
// These functions import data directly into the database. Security and permission checks are bypassed but validity is
// still enforced.
//

func (a *App) importScheme(data *SchemeImportData, dryRun bool) *model.AppError {
	if err := validateSchemeImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	scheme, err := a.GetSchemeByName(*data.Name)
	if err != nil {
		scheme = new(model.Scheme)
	} else if scheme.Scope != *data.Scope {
		return model.NewAppError("BulkImport", "app.import.import_scheme.scope_change.error", map[string]interface{}{"SchemeName": scheme.Name}, "", http.StatusBadRequest)
	}

	scheme.Name = *data.Name
	scheme.DisplayName = *data.DisplayName
	scheme.Scope = *data.Scope

	if data.Description != nil {
		scheme.Description = *data.Description
	}

	if len(scheme.Id) == 0 {
		scheme, err = a.CreateScheme(scheme)
	} else {
		scheme, err = a.UpdateScheme(scheme)
	}

	if err != nil {
		return err
	}

	if scheme.Scope == model.SCHEME_SCOPE_TEAM {
		data.DefaultTeamAdminRole.Name = &scheme.DefaultTeamAdminRole
		if err := a.importRole(data.DefaultTeamAdminRole, dryRun, true); err != nil {
			return err
		}

		data.DefaultTeamUserRole.Name = &scheme.DefaultTeamUserRole
		if err := a.importRole(data.DefaultTeamUserRole, dryRun, true); err != nil {
			return err
		}

		if data.DefaultTeamGuestRole == nil {
			data.DefaultTeamGuestRole = &RoleImportData{
				DisplayName: model.NewString("Team Guest Role for Scheme"),
			}
		}
		data.DefaultTeamGuestRole.Name = &scheme.DefaultTeamGuestRole
		if err := a.importRole(data.DefaultTeamGuestRole, dryRun, true); err != nil {
			return err
		}
	}

	if scheme.Scope == model.SCHEME_SCOPE_TEAM || scheme.Scope == model.SCHEME_SCOPE_CHANNEL {
		data.DefaultChannelAdminRole.Name = &scheme.DefaultChannelAdminRole
		if err := a.importRole(data.DefaultChannelAdminRole, dryRun, true); err != nil {
			return err
		}

		data.DefaultChannelUserRole.Name = &scheme.DefaultChannelUserRole
		if err := a.importRole(data.DefaultChannelUserRole, dryRun, true); err != nil {
			return err
		}

		if data.DefaultChannelGuestRole == nil {
			data.DefaultChannelGuestRole = &RoleImportData{
				DisplayName: model.NewString("Channel Guest Role for Scheme"),
			}
		}
		data.DefaultChannelGuestRole.Name = &scheme.DefaultChannelGuestRole
		if err := a.importRole(data.DefaultChannelGuestRole, dryRun, true); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) importRole(data *RoleImportData, dryRun bool, isSchemeRole bool) *model.AppError {
	if !isSchemeRole {
		if err := validateRoleImportData(data); err != nil {
			return err
		}
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	role, err := a.GetRoleByName(*data.Name)
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

	if isSchemeRole {
		role.SchemeManaged = true
	} else {
		role.SchemeManaged = false
	}

	if len(role.Id) == 0 {
		_, err = a.CreateRole(role)
	} else {
		_, err = a.UpdateRole(role)
	}

	return err
}

func (a *App) importTeam(data *TeamImportData, dryRun bool) *model.AppError {
	if err := validateTeamImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var team *model.Team
	team, err := a.Srv.Store.Team().GetByName(*data.Name)

	if err != nil {
		team = &model.Team{}
	}

	team.Name = *data.Name
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

		if scheme.Scope != model.SCHEME_SCOPE_TEAM {
			return model.NewAppError("BulkImport", "app.import.import_team.scheme_wrong_scope.error", nil, "", http.StatusBadRequest)
		}

		team.SchemeId = &scheme.Id
	}

	if team.Id == "" {
		if _, err := a.CreateTeam(team); err != nil {
			return err
		}
	} else {
		if _, err := a.updateTeamUnsanitized(team); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) importChannel(data *ChannelImportData, dryRun bool) *model.AppError {
	if err := validateChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	team, err := a.Srv.Store.Team().GetByName(*data.Team)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_channel.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, err.Error(), http.StatusBadRequest)
	}

	var channel *model.Channel
	if result, err := a.Srv.Store.Channel().GetByNameIncludeDeleted(team.Id, *data.Name, true); err == nil {
		channel = result
	} else {
		channel = &model.Channel{}
	}

	channel.TeamId = team.Id
	channel.Name = *data.Name
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

		if scheme.Scope != model.SCHEME_SCOPE_CHANNEL {
			return model.NewAppError("BulkImport", "app.import.import_channel.scheme_wrong_scope.error", nil, "", http.StatusBadRequest)
		}

		channel.SchemeId = &scheme.Id
	}

	if channel.Id == "" {
		if _, err := a.CreateChannel(channel, false); err != nil {
			return err
		}
	} else {
		if _, err := a.UpdateChannel(channel); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) importUser(data *UserImportData, dryRun bool) *model.AppError {
	if err := validateUserImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	// We want to avoid database writes if nothing has changed.
	hasUserChanged := false
	hasNotifyPropsChanged := false
	hasUserRolesChanged := false
	hasUserAuthDataChanged := false
	hasUserEmailVerifiedChanged := false

	var user *model.User
	var err *model.AppError
	user, err = a.Srv.Store.User().GetByUsername(*data.Username)
	if err != nil {
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
		// If no AuthData or Password is specified, we must generate a password.
		password = model.GeneratePassword(*a.Config().PasswordSettings.MinimumLength)
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
	} else if len(user.Roles) == 0 {
		// Set SYSTEM_USER roles on newly created users by default.
		if user.Roles != model.SYSTEM_USER_ROLE_ID {
			roles = model.SYSTEM_USER_ROLE_ID
			hasUserRolesChanged = true
		}
	}
	user.Roles = roles

	if data.NotifyProps != nil {
		if data.NotifyProps.Desktop != nil {
			if value, ok := user.NotifyProps[model.DESKTOP_NOTIFY_PROP]; !ok || value != *data.NotifyProps.Desktop {
				user.AddNotifyProp(model.DESKTOP_NOTIFY_PROP, *data.NotifyProps.Desktop)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.DesktopSound != nil {
			if value, ok := user.NotifyProps[model.DESKTOP_SOUND_NOTIFY_PROP]; !ok || value != *data.NotifyProps.DesktopSound {
				user.AddNotifyProp(model.DESKTOP_SOUND_NOTIFY_PROP, *data.NotifyProps.DesktopSound)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.Email != nil {
			if value, ok := user.NotifyProps[model.EMAIL_NOTIFY_PROP]; !ok || value != *data.NotifyProps.Email {
				user.AddNotifyProp(model.EMAIL_NOTIFY_PROP, *data.NotifyProps.Email)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.Mobile != nil {
			if value, ok := user.NotifyProps[model.PUSH_NOTIFY_PROP]; !ok || value != *data.NotifyProps.Mobile {
				user.AddNotifyProp(model.PUSH_NOTIFY_PROP, *data.NotifyProps.Mobile)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.MobilePushStatus != nil {
			if value, ok := user.NotifyProps[model.PUSH_STATUS_NOTIFY_PROP]; !ok || value != *data.NotifyProps.MobilePushStatus {
				user.AddNotifyProp(model.PUSH_STATUS_NOTIFY_PROP, *data.NotifyProps.MobilePushStatus)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.ChannelTrigger != nil {
			if value, ok := user.NotifyProps[model.CHANNEL_MENTIONS_NOTIFY_PROP]; !ok || value != *data.NotifyProps.ChannelTrigger {
				user.AddNotifyProp(model.CHANNEL_MENTIONS_NOTIFY_PROP, *data.NotifyProps.ChannelTrigger)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.CommentsTrigger != nil {
			if value, ok := user.NotifyProps[model.COMMENTS_NOTIFY_PROP]; !ok || value != *data.NotifyProps.CommentsTrigger {
				user.AddNotifyProp(model.COMMENTS_NOTIFY_PROP, *data.NotifyProps.CommentsTrigger)
				hasNotifyPropsChanged = true
			}
		}

		if data.NotifyProps.MentionKeys != nil {
			if value, ok := user.NotifyProps[model.MENTION_KEYS_NOTIFY_PROP]; !ok || value != *data.NotifyProps.MentionKeys {
				user.AddNotifyProp(model.MENTION_KEYS_NOTIFY_PROP, *data.NotifyProps.MentionKeys)
				hasNotifyPropsChanged = true
			}
		} else {
			user.UpdateMentionKeysFromUsername("")
		}
	}

	var savedUser *model.User
	if user.Id == "" {
		if savedUser, err = a.createUser(user); err != nil {
			return err
		}
	} else {
		if hasUserChanged {
			if savedUser, err = a.UpdateUser(user, false); err != nil {
				return err
			}
		}
		if hasUserRolesChanged {
			if savedUser, err = a.UpdateUserRoles(user.Id, roles, false); err != nil {
				return err
			}
		}
		if hasNotifyPropsChanged {
			if savedUser, err = a.UpdateUserNotifyProps(user.Id, user.NotifyProps); err != nil {
				return err
			}
		}
		if len(password) > 0 {
			if err = a.UpdatePassword(user, password); err != nil {
				return err
			}
		} else {
			if hasUserAuthDataChanged {
				if _, err = a.Srv.Store.User().UpdateAuthData(user.Id, authService, authData, user.Email, false); err != nil {
					return err
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

	if data.ProfileImage != nil {
		file, err := os.Open(*data.ProfileImage)
		if err != nil {
			mlog.Error("Unable to open the profile image.", mlog.Any("err", err))
		}
		if err := a.SetProfileImageFromMultiPartFile(savedUser.Id, file); err != nil {
			mlog.Error("Unable to set the profile image from a file.", mlog.Any("err", err))
		}
	}

	// Preferences.
	var preferences model.Preferences

	if data.Theme != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_THEME,
			Name:     "",
			Value:    *data.Theme,
		})
	}

	if data.UseMilitaryTime != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     model.PREFERENCE_NAME_USE_MILITARY_TIME,
			Value:    *data.UseMilitaryTime,
		})
	}

	if data.CollapsePreviews != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     model.PREFERENCE_NAME_COLLAPSE_SETTING,
			Value:    *data.CollapsePreviews,
		})
	}

	if data.MessageDisplay != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     model.PREFERENCE_NAME_MESSAGE_DISPLAY,
			Value:    *data.MessageDisplay,
		})
	}

	if data.ChannelDisplayMode != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "channel_display_mode",
			Value:    *data.ChannelDisplayMode,
		})
	}

	if data.TutorialStep != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_TUTORIAL_STEPS,
			Name:     savedUser.Id,
			Value:    *data.TutorialStep,
		})
	}

	if data.UseMarkdownPreview != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS,
			Name:     "feature_enabled_markdown_preview",
			Value:    *data.UseMarkdownPreview,
		})
	}

	if data.UseFormatting != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS,
			Name:     "formatting",
			Value:    *data.UseFormatting,
		})
	}

	if data.ShowUnreadSection != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_SIDEBAR_SETTINGS,
			Name:     "show_unread_section",
			Value:    *data.ShowUnreadSection,
		})
	}

	if data.EmailInterval != nil || savedUser.NotifyProps[model.EMAIL_NOTIFY_PROP] == "false" {
		var intervalSeconds string
		if value := savedUser.NotifyProps[model.EMAIL_NOTIFY_PROP]; value == "false" {
			intervalSeconds = "0"
		} else {
			switch *data.EmailInterval {
			case model.PREFERENCE_EMAIL_INTERVAL_IMMEDIATELY:
				intervalSeconds = model.PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS
			case model.PREFERENCE_EMAIL_INTERVAL_FIFTEEN:
				intervalSeconds = model.PREFERENCE_EMAIL_INTERVAL_FIFTEEN_AS_SECONDS
			case model.PREFERENCE_EMAIL_INTERVAL_HOUR:
				intervalSeconds = model.PREFERENCE_EMAIL_INTERVAL_HOUR_AS_SECONDS
			}
		}
		if intervalSeconds != "" {
			preferences = append(preferences, model.Preference{
				UserId:   savedUser.Id,
				Category: model.PREFERENCE_CATEGORY_NOTIFICATIONS,
				Name:     model.PREFERENCE_NAME_EMAIL_INTERVAL,
				Value:    intervalSeconds,
			})
		}
	}

	if len(preferences) > 0 {
		if err := a.Srv.Store.Preference().Save(&preferences); err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return a.importUserTeams(savedUser, data.Teams)
}

func (a *App) importUserTeams(user *model.User, data *[]UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	var teamThemePreferences model.Preferences
	for _, tdata := range *data {
		team, err := a.GetTeamByName(*tdata.Name)
		if err != nil {
			return err
		}

		// Team-specific theme Preferences.
		if tdata.Theme != nil {
			teamThemePreferences = append(teamThemePreferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_THEME,
				Name:     team.Id,
				Value:    *tdata.Theme,
			})
		}

		var roles string
		isSchemeGuest := false
		isSchemeUser := true
		isSchemeAdmin := false

		if tdata.Roles == nil {
			isSchemeUser = true
		} else {
			rawRoles := *tdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.TEAM_GUEST_ROLE_ID {
					isSchemeGuest = true
					isSchemeUser = false
				} else if role == model.TEAM_USER_ROLE_ID {
					isSchemeUser = true
				} else if role == model.TEAM_ADMIN_ROLE_ID {
					isSchemeAdmin = true
				} else {
					explicitRoles = append(explicitRoles, role)
				}
			}
			roles = strings.Join(explicitRoles, " ")
		}

		var member *model.TeamMember
		if member, _, err = a.joinUserToTeam(team, user); err != nil {
			return err
		}

		if member.ExplicitRoles != roles {
			if _, err = a.UpdateTeamMemberRoles(team.Id, user.Id, roles); err != nil {
				return err
			}
		}

		if member.SchemeAdmin != isSchemeAdmin || member.SchemeUser != isSchemeUser || member.SchemeGuest != isSchemeGuest {
			a.UpdateTeamMemberSchemeRoles(team.Id, user.Id, isSchemeGuest, isSchemeUser, isSchemeAdmin)
		}

		defaultChannel, err := a.GetChannelByName(model.DEFAULT_CHANNEL, team.Id, true)
		if err != nil {
			return err
		}

		if _, err = a.addUserToChannel(user, defaultChannel, member); err != nil {
			return err
		}

		if err := a.importUserChannels(user, team, member, tdata.Channels); err != nil {
			return err
		}
	}

	if len(teamThemePreferences) > 0 {
		if err := a.Srv.Store.Preference().Save(&teamThemePreferences); err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user_teams.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) importUserChannels(user *model.User, team *model.Team, teamMember *model.TeamMember, data *[]UserChannelImportData) *model.AppError {
	if data == nil {
		return nil
	}

	var preferences model.Preferences

	// Loop through all channels.
	for _, cdata := range *data {
		channel, err := a.GetChannelByName(*cdata.Name, team.Id, true)
		if err != nil {
			return err
		}

		var roles string
		isSchemeGuest := false
		isSchemeUser := true
		isSchemeAdmin := false

		if cdata.Roles == nil {
			isSchemeUser = true
		} else {
			rawRoles := *cdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.CHANNEL_GUEST_ROLE_ID {
					isSchemeGuest = true
					isSchemeUser = false
				} else if role == model.CHANNEL_USER_ROLE_ID {
					isSchemeUser = true
				} else if role == model.CHANNEL_ADMIN_ROLE_ID {
					isSchemeAdmin = true
				} else {
					explicitRoles = append(explicitRoles, role)
				}
			}
			roles = strings.Join(explicitRoles, " ")
		}

		var member *model.ChannelMember
		member, err = a.GetChannelMember(channel.Id, user.Id)
		if err != nil {
			member, err = a.addUserToChannel(user, channel, teamMember)
			if err != nil {
				return err
			}
		}

		if member.ExplicitRoles != roles {
			if _, err := a.UpdateChannelMemberRoles(channel.Id, user.Id, roles); err != nil {
				return err
			}
		}

		if member.SchemeAdmin != isSchemeAdmin || member.SchemeUser != isSchemeUser || member.SchemeGuest != isSchemeGuest {
			a.UpdateChannelMemberSchemeRoles(channel.Id, user.Id, isSchemeGuest, isSchemeUser, isSchemeAdmin)
		}

		if cdata.NotifyProps != nil {
			notifyProps := member.NotifyProps

			if cdata.NotifyProps.Desktop != nil {
				notifyProps[model.DESKTOP_NOTIFY_PROP] = *cdata.NotifyProps.Desktop
			}

			if cdata.NotifyProps.Mobile != nil {
				notifyProps[model.PUSH_NOTIFY_PROP] = *cdata.NotifyProps.Mobile
			}

			if cdata.NotifyProps.MarkUnread != nil {
				notifyProps[model.MARK_UNREAD_NOTIFY_PROP] = *cdata.NotifyProps.MarkUnread
			}

			if _, err := a.UpdateChannelMemberNotifyProps(notifyProps, channel.Id, user.Id); err != nil {
				return err
			}
		}

		if cdata.Favorite != nil && *cdata.Favorite {
			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			})
		}
	}

	if len(preferences) > 0 {
		if err := a.Srv.Store.Preference().Save(&preferences); err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user_channels.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) importReaction(data *ReactionImportData, post *model.Post, dryRun bool) *model.AppError {
	var err *model.AppError
	if err = validateReactionImportData(data, post.CreateAt); err != nil {
		return err
	}

	var user *model.User
	user, err = a.Srv.Store.User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": data.User}, err.Error(), http.StatusBadRequest)
	}

	reaction := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: *data.EmojiName,
		CreateAt:  *data.CreateAt,
	}
	if _, err = a.Srv.Store.Reaction().Save(reaction); err != nil {
		return err
	}

	return nil
}

func (a *App) importReply(data *ReplyImportData, post *model.Post, teamId string, dryRun bool) *model.AppError {
	var err *model.AppError
	if err = validateReplyImportData(data, post.CreateAt, a.MaxPostSize()); err != nil {
		return err
	}

	var user *model.User
	user, err = a.Srv.Store.User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": data.User}, err.Error(), http.StatusBadRequest)
	}

	// Check if this post already exists.
	replies, err := a.Srv.Store.Post().GetPostsCreatedAt(post.ChannelId, *data.CreateAt)
	if err != nil {
		return err
	}

	var reply *model.Post
	for _, r := range replies {
		if r.Message == *data.Message && r.RootId == post.Id {
			reply = r
			break
		}
	}

	if reply == nil {
		reply = &model.Post{}
	}
	reply.UserId = user.Id
	reply.ChannelId = post.ChannelId
	reply.ParentId = post.Id
	reply.RootId = post.Id
	reply.Message = *data.Message
	reply.CreateAt = *data.CreateAt

	fileIds, err := a.uploadAttachments(data.Attachments, reply, teamId, dryRun)
	if err != nil {
		return err
	}
	for _, fileID := range reply.FileIds {
		if _, ok := fileIds[fileID]; !ok {
			a.Srv.Store.FileInfo().PermanentDelete(fileID)
		}
	}
	reply.FileIds = make([]string, 0)
	for fileID := range fileIds {
		reply.FileIds = append(reply.FileIds, fileID)
	}

	if reply.Id == "" {
		if _, err := a.Srv.Store.Post().Save(reply); err != nil {
			return err
		}
	} else {
		if _, err := a.Srv.Store.Post().Overwrite(reply); err != nil {
			return err
		}
	}

	a.updateFileInfoWithPostId(reply)

	return nil
}

func (a *App) importAttachment(data *AttachmentImportData, post *model.Post, teamId string, dryRun bool) (*model.FileInfo, *model.AppError) {
	file, err := os.Open(*data.Path)
	if file == nil || err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.attachment.bad_file.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
	}

	timestamp := utils.TimeFromMillis(post.CreateAt)
	buf := bytes.NewBuffer(nil)
	_, _ = io.Copy(buf, file)
	// Go over existing files in the post and see if there already exists a file with the same name, size and hash. If so - skip it
	if post.Id != "" {
		oldFiles, err := a.GetFileInfosForPost(post.Id, true)
		if err != nil {
			return nil, model.NewAppError("BulkImport", "app.import.attachment.file_upload.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
		}
		for _, oldFile := range oldFiles {
			if oldFile.Name != path.Base(file.Name()) || oldFile.Size != int64(buf.Len()) {
				continue
			}
			// check md5
			newHash := sha1.Sum(buf.Bytes())
			oldFileData, err := a.GetFile(oldFile.Id)
			if err != nil {
				return nil, model.NewAppError("BulkImport", "app.import.attachment.file_upload.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
			}
			oldHash := sha1.Sum(oldFileData)

			if bytes.Equal(oldHash[:], newHash[:]) {
				mlog.Info("Skipping uploading of file because name already exists", mlog.Any("file_name", file.Name()))
				return oldFile, nil
			}
		}
	}
	fileInfo, appErr := a.DoUploadFile(timestamp, teamId, post.ChannelId, post.UserId, file.Name(), buf.Bytes())
	if appErr != nil {
		mlog.Error("Failed to upload file:", mlog.Err(err))
		return nil, appErr
	}

	a.HandleImages([]string{fileInfo.PreviewPath}, []string{fileInfo.ThumbnailPath}, [][]byte{buf.Bytes()})

	mlog.Info("Uploading file with name", mlog.String("file_name", file.Name()))
	return fileInfo, nil
}

func (a *App) importPost(data *PostImportData, dryRun bool) *model.AppError {
	if err := validatePostImportData(data, a.MaxPostSize()); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	team, err := a.Srv.Store.Team().GetByName(*data.Team)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, err.Error(), http.StatusBadRequest)
	}

	channel, err := a.Srv.Store.Channel().GetByName(team.Id, *data.Channel, false)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.channel_not_found.error", map[string]interface{}{"ChannelName": *data.Channel}, err.Error(), http.StatusBadRequest)
	}

	var user *model.User
	user, err = a.Srv.Store.User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, err.Error(), http.StatusBadRequest)
	}

	// Check if this post already exists.
	posts, err := a.Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt)
	if err != nil {
		return err
	}

	var post *model.Post
	for _, p := range posts {
		if p.Message == *data.Message {
			post = p
			break
		}
	}

	if post == nil {
		post = &model.Post{}
	}

	post.ChannelId = channel.Id
	post.Message = *data.Message
	post.UserId = user.Id
	post.CreateAt = *data.CreateAt

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	fileIds, err := a.uploadAttachments(data.Attachments, post, team.Id, dryRun)
	if err != nil {
		return err
	}
	for _, fileID := range post.FileIds {
		if _, ok := fileIds[fileID]; !ok {
			a.Srv.Store.FileInfo().PermanentDelete(fileID)
		}
	}
	post.FileIds = make([]string, 0)
	for fileID := range fileIds {
		post.FileIds = append(post.FileIds, fileID)
	}

	if post.Id == "" {
		if _, err = a.Srv.Store.Post().Save(post); err != nil {
			return err
		}
	} else {
		if _, err = a.Srv.Store.Post().Overwrite(post); err != nil {
			return err
		}
	}

	if data.FlaggedBy != nil {
		var preferences model.Preferences

		for _, username := range *data.FlaggedBy {
			var user *model.User
			user, err = a.Srv.Store.User().GetByUsername(username)
			if err != nil {
				return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": username}, err.Error(), http.StatusBadRequest)
			}

			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
				Name:     post.Id,
				Value:    "true",
			})
		}

		if len(preferences) > 0 {
			if err := a.Srv.Store.Preference().Save(&preferences); err != nil {
				return model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if data.Reactions != nil {
		for _, reaction := range *data.Reactions {
			if err := a.importReaction(&reaction, post, dryRun); err != nil {
				return err
			}
		}
	}

	if data.Replies != nil {
		for _, reply := range *data.Replies {
			if err := a.importReply(&reply, post, team.Id, dryRun); err != nil {
				return err
			}
		}
	}

	a.updateFileInfoWithPostId(post)
	return nil
}

// uploadAttachments imports new attachments and returns current attachments of the post as a map
func (a *App) uploadAttachments(attachments *[]AttachmentImportData, post *model.Post, teamId string, dryRun bool) (map[string]bool, *model.AppError) {
	if attachments == nil {
		return nil, nil
	}
	fileIds := make(map[string]bool)
	for _, attachment := range *attachments {
		fileInfo, err := a.importAttachment(&attachment, post, teamId, dryRun)
		if err != nil {
			return nil, err
		}
		fileIds[fileInfo.Id] = true
	}
	return fileIds, nil
}

func (a *App) updateFileInfoWithPostId(post *model.Post) {
	for _, fileId := range post.FileIds {
		if err := a.Srv.Store.FileInfo().AttachToPost(fileId, post.Id, post.UserId); err != nil {
			mlog.Error("Error attaching files to post.", mlog.String("post_id", post.Id), mlog.Any("post_file_ids", post.FileIds), mlog.Err(err))
		}
	}
}
func (a *App) importDirectChannel(data *DirectChannelImportData, dryRun bool) *model.AppError {
	var err *model.AppError
	if err = validateDirectChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var userIds []string
	userMap := make(map[string]string)
	for _, username := range *data.Members {
		var user *model.User
		user, err = a.Srv.Store.User().GetByUsername(username)
		if err != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.member_not_found.error", nil, err.Error(), http.StatusBadRequest)
		}
		userIds = append(userIds, user.Id)
		userMap[username] = user.Id
	}

	var channel *model.Channel

	if len(userIds) == 2 {
		ch, err := a.createDirectChannel(userIds[0], userIds[1])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_direct_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	} else {
		ch, err := a.createGroupChannel(userIds, userIds[0])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_group_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	}

	var preferences model.Preferences

	for _, userId := range userIds {
		preferences = append(preferences, model.Preference{
			UserId:   userId,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     channel.Id,
			Value:    "true",
		})
	}

	if data.FavoritedBy != nil {
		for _, favoriter := range *data.FavoritedBy {
			preferences = append(preferences, model.Preference{
				UserId:   userMap[favoriter],
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			})
		}
	}

	if err := a.Srv.Store.Preference().Save(&preferences); err != nil {
		err.StatusCode = http.StatusBadRequest
		return err
	}

	if data.Header != nil {
		channel.Header = *data.Header
		if _, appErr := a.Srv.Store.Channel().Update(channel); appErr != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.update_header_failed.error", nil, appErr.Error(), http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) importDirectPost(data *DirectPostImportData, dryRun bool) *model.AppError {
	var err *model.AppError
	if err = validateDirectPostImportData(data, a.MaxPostSize()); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var userIds []string
	for _, username := range *data.ChannelMembers {
		var user *model.User
		user, err = a.Srv.Store.User().GetByUsername(username)
		if err != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.channel_member_not_found.error", nil, err.Error(), http.StatusBadRequest)
		}
		userIds = append(userIds, user.Id)
	}

	var channel *model.Channel
	var ch *model.Channel
	if len(userIds) == 2 {
		ch, err = a.createDirectChannel(userIds[0], userIds[1])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.create_direct_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	} else {
		ch, err = a.createGroupChannel(userIds, userIds[0])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.create_group_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	}

	var user *model.User
	user, err = a.Srv.Store.User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_direct_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, "", http.StatusBadRequest)
	}

	// Check if this post already exists.
	posts, err := a.Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt)
	if err != nil {
		return err
	}

	var post *model.Post
	for _, p := range posts {
		if p.Message == *data.Message {
			post = p
			break
		}
	}

	if post == nil {
		post = &model.Post{}
	}

	post.ChannelId = channel.Id
	post.Message = *data.Message
	post.UserId = user.Id
	post.CreateAt = *data.CreateAt

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	fileIds, err := a.uploadAttachments(data.Attachments, post, "noteam", dryRun)
	if err != nil {
		return err
	}
	for _, fileID := range post.FileIds {
		if _, ok := fileIds[fileID]; !ok {
			a.Srv.Store.FileInfo().PermanentDelete(fileID)
		}
	}
	post.FileIds = make([]string, 0)
	for fileID := range fileIds {
		post.FileIds = append(post.FileIds, fileID)
	}

	if post.Id == "" {
		if _, err = a.Srv.Store.Post().Save(post); err != nil {
			return err
		}
	} else {
		if _, err = a.Srv.Store.Post().Overwrite(post); err != nil {
			return err
		}
	}

	if data.FlaggedBy != nil {
		var preferences model.Preferences

		for _, username := range *data.FlaggedBy {
			var user *model.User
			user, err = a.Srv.Store.User().GetByUsername(username)
			if err != nil {
				return model.NewAppError("BulkImport", "app.import.import_direct_post.user_not_found.error", map[string]interface{}{"Username": username}, "", http.StatusBadRequest)
			}

			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
				Name:     post.Id,
				Value:    "true",
			})
		}

		if len(preferences) > 0 {
			if err := a.Srv.Store.Preference().Save(&preferences); err != nil {
				return model.NewAppError("BulkImport", "app.import.import_direct_post.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if data.Reactions != nil {
		for _, reaction := range *data.Reactions {
			if err := a.importReaction(&reaction, post, dryRun); err != nil {
				return err
			}
		}
	}

	if data.Replies != nil {
		for _, reply := range *data.Replies {
			if err := a.importReply(&reply, post, "noteam", dryRun); err != nil {
				return err
			}
		}
	}

	a.updateFileInfoWithPostId(post)
	return nil
}

func (a *App) importEmoji(data *EmojiImportData, dryRun bool) *model.AppError {
	if err := validateEmojiImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var emoji *model.Emoji

	emoji, appError := a.Srv.Store.Emoji().GetByName(*data.Name, true)
	if appError != nil && appError.StatusCode != http.StatusNotFound {
		return appError
	}

	alreadyExists := emoji != nil

	if !alreadyExists {
		emoji = &model.Emoji{
			Name: *data.Name,
		}
		emoji.PreSave()
	}

	file, err := os.Open(*data.Image)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.emoji.bad_file.error", map[string]interface{}{"EmojiName": *data.Name}, "", http.StatusBadRequest)
	}

	if _, err := a.WriteFile(file, getEmojiImagePath(emoji.Id)); err != nil {
		return err
	}

	if !alreadyExists {
		if _, err := a.Srv.Store.Emoji().Save(emoji); err != nil {
			return err
		}
	}

	return nil
}
