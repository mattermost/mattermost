// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"crypto/sha1"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
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

	if scheme.Id == "" {
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

	if role.Id == "" {
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
	team, err := a.Srv().Store.Team().GetByName(*data.Name)

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

	team, err := a.Srv().Store.Team().GetByName(*data.Team)
	if err != nil {
		return model.NewAppError("BulkImport", "app.import.import_channel.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, err.Error(), http.StatusBadRequest)
	}

	var channel *model.Channel
	if result, err := a.Srv().Store.Channel().GetByNameIncludeDeleted(team.Id, *data.Name, true); err == nil {
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
	var nErr error
	user, nErr = a.Srv().Store.User().GetByUsername(*data.Username)
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
			return model.NewAppError("importUser", "app.import.generate_password.app_error", nil, err.Error(), http.StatusInternalServerError)
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
	var err *model.AppError
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
			if savedUser, err = a.UpdateUserNotifyProps(user.Id, user.NotifyProps, false); err != nil {
				return err
			}
		}
		if password != "" {
			if err = a.UpdatePassword(user, password); err != nil {
				return err
			}
		} else {
			if hasUserAuthDataChanged {
				if _, nErr := a.Srv().Store.User().UpdateAuthData(user.Id, authService, authData, user.Email, false); nErr != nil {
					var invErr *store.ErrInvalidInput
					switch {
					case errors.As(nErr, &invErr):
						return model.NewAppError("importUser", "app.user.update_auth_data.email_exists.app_error", nil, invErr.Error(), http.StatusBadRequest)
					default:
						return model.NewAppError("importUser", "app.user.update_auth_data.app_error", nil, nErr.Error(), http.StatusInternalServerError)
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

	if data.ProfileImage != nil {
		file, err := os.Open(*data.ProfileImage)
		if err != nil {
			mlog.Warn("Unable to open the profile image.", mlog.Err(err))
		}
		defer file.Close()
		if err == nil {
			if err := a.SetProfileImageFromMultiPartFile(savedUser.Id, file); err != nil {
				mlog.Warn("Unable to set the profile image from a file.", mlog.Err(err))
			}
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
		if err := a.Srv().Store.Preference().Save(&preferences); err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return a.importUserTeams(savedUser, data.Teams)
}

func (a *App) importUserTeams(user *model.User, data *[]UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	teamNames := []string{}
	for _, tdata := range *data {
		teamNames = append(teamNames, *tdata.Name)
	}
	allTeams, err := a.getTeamsByNames(teamNames)
	if err != nil {
		return err
	}

	teamThemePreferencesByID := map[string]model.Preferences{}
	channels := map[string][]UserChannelImportData{}
	teamsByID := map[string]*model.Team{}
	teamMemberByTeamID := map[string]*model.TeamMember{}
	newTeamMembers := []*model.TeamMember{}
	oldTeamMembers := []*model.TeamMember{}
	rolesByTeamId := map[string]string{}
	isGuestByTeamId := map[string]bool{}
	isUserByTeamId := map[string]bool{}
	isAdminByTeamId := map[string]bool{}
	existingMemberships, nErr := a.Srv().Store.Team().GetTeamsForUser(context.Background(), user.Id)
	if nErr != nil {
		return model.NewAppError("importUserTeams", "app.team.get_members.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	existingMembershipsByTeamId := map[string]*model.TeamMember{}
	for _, teamMembership := range existingMemberships {
		existingMembershipsByTeamId[teamMembership.TeamId] = teamMembership
	}
	for _, tdata := range *data {
		team := allTeams[*tdata.Name]

		// Team-specific theme Preferences.
		if tdata.Theme != nil {
			teamThemePreferencesByID[team.Id] = append(teamThemePreferencesByID[team.Id], model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_THEME,
				Name:     team.Id,
				Value:    *tdata.Theme,
			})
		}

		isGuestByTeamId[team.Id] = false
		isUserByTeamId[team.Id] = true
		isAdminByTeamId[team.Id] = false

		if tdata.Roles == nil {
			isUserByTeamId[team.Id] = true
		} else {
			rawRoles := *tdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.TEAM_GUEST_ROLE_ID {
					isGuestByTeamId[team.Id] = true
					isUserByTeamId[team.Id] = false
				} else if role == model.TEAM_USER_ROLE_ID {
					isUserByTeamId[team.Id] = true
				} else if role == model.TEAM_ADMIN_ROLE_ID {
					isAdminByTeamId[team.Id] = true
				} else {
					explicitRoles = append(explicitRoles, role)
				}
			}
			rolesByTeamId[team.Id] = strings.Join(explicitRoles, " ")
		}

		member := &model.TeamMember{
			TeamId:      team.Id,
			UserId:      user.Id,
			SchemeGuest: user.IsGuest(),
			SchemeUser:  !user.IsGuest(),
			SchemeAdmin: team.Email == user.Email && !user.IsGuest(),
		}
		if !user.IsGuest() {
			var userShouldBeAdmin bool
			userShouldBeAdmin, err = a.UserIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
			if err != nil {
				return err
			}
			member.SchemeAdmin = userShouldBeAdmin
		}

		if tdata.Channels != nil {
			channels[team.Id] = append(channels[team.Id], *tdata.Channels...)
		}
		if !user.IsGuest() {
			channels[team.Id] = append(channels[team.Id], UserChannelImportData{Name: model.NewString(model.DEFAULT_CHANNEL)})
		}

		teamsByID[team.Id] = team
		teamMemberByTeamID[team.Id] = member
		if _, ok := existingMembershipsByTeamId[team.Id]; !ok {
			newTeamMembers = append(newTeamMembers, member)
		} else {
			oldTeamMembers = append(oldTeamMembers, member)
		}
	}

	oldMembers, nErr := a.Srv().Store.Team().UpdateMultipleMembers(oldTeamMembers)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("importUserTeams", "app.team.save_member.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	newMembers := []*model.TeamMember{}
	if len(newTeamMembers) > 0 {
		var nErr error
		newMembers, nErr = a.Srv().Store.Team().SaveMultipleMembers(newTeamMembers, *a.Config().TeamSettings.MaxUsersPerTeam)
		if nErr != nil {
			var appErr *model.AppError
			var conflictErr *store.ErrConflict
			var limitExeededErr *store.ErrLimitExceeded
			switch {
			case errors.As(nErr, &appErr): // in case we haven't converted to plain error.
				return appErr
			case errors.As(nErr, &conflictErr):
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_members.conflict.app_error", nil, nErr.Error(), http.StatusBadRequest)
			case errors.As(nErr, &limitExeededErr):
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_members.max_accounts.app_error", nil, nErr.Error(), http.StatusBadRequest)
			default: // last fallback in case it doesn't map to an existing app error.
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_members.error", nil, nErr.Error(), http.StatusInternalServerError)
			}
		}
	}

	for _, member := range append(newMembers, oldMembers...) {
		if member.ExplicitRoles != rolesByTeamId[member.TeamId] {
			if _, err = a.UpdateTeamMemberRoles(member.TeamId, user.Id, rolesByTeamId[member.TeamId]); err != nil {
				return err
			}
		}

		a.UpdateTeamMemberSchemeRoles(member.TeamId, user.Id, isGuestByTeamId[member.TeamId], isUserByTeamId[member.TeamId], isAdminByTeamId[member.TeamId])
	}

	for _, team := range allTeams {
		if len(teamThemePreferencesByID[team.Id]) > 0 {
			pref := teamThemePreferencesByID[team.Id]
			if err := a.Srv().Store.Preference().Save(&pref); err != nil {
				return model.NewAppError("BulkImport", "app.import.import_user_teams.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
		channelsToImport := channels[team.Id]
		if err := a.importUserChannels(user, team, &channelsToImport); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) importUserChannels(user *model.User, team *model.Team, data *[]UserChannelImportData) *model.AppError {
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

	channelsByID := map[string]*model.Channel{}
	channelMemberByChannelID := map[string]*model.ChannelMember{}
	newChannelMembers := []*model.ChannelMember{}
	oldChannelMembers := []*model.ChannelMember{}
	rolesByChannelId := map[string]string{}
	channelPreferencesByID := map[string]model.Preferences{}
	isGuestByChannelId := map[string]bool{}
	isUserByChannelId := map[string]bool{}
	isAdminByChannelId := map[string]bool{}
	existingMemberships, nErr := a.Srv().Store.Channel().GetMembersForUser(team.Id, user.Id)
	if nErr != nil {
		return model.NewAppError("importUserChannels", "app.channel.get_members.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	existingMembershipsByChannelId := map[string]model.ChannelMember{}
	for _, channelMembership := range *existingMemberships {
		existingMembershipsByChannelId[channelMembership.ChannelId] = channelMembership
	}
	for _, cdata := range *data {
		channel, ok := allChannels[*cdata.Name]
		if !ok {
			return model.NewAppError("BulkImport", "app.import.import_user_channels.channel_not_found.error", nil, "", http.StatusInternalServerError)
		}
		if _, ok = channelsByID[channel.Id]; ok && *cdata.Name == model.DEFAULT_CHANNEL {
			// town-square membership was in the import and added by the importer (skip the added by the importer)
			continue
		}

		isGuestByChannelId[channel.Id] = false
		isUserByChannelId[channel.Id] = true
		isAdminByChannelId[channel.Id] = false

		if cdata.Roles == nil {
			isUserByChannelId[channel.Id] = true
		} else {
			rawRoles := *cdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.CHANNEL_GUEST_ROLE_ID {
					isGuestByChannelId[channel.Id] = true
					isUserByChannelId[channel.Id] = false
				} else if role == model.CHANNEL_USER_ROLE_ID {
					isUserByChannelId[channel.Id] = true
				} else if role == model.CHANNEL_ADMIN_ROLE_ID {
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
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
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

		if cdata.NotifyProps != nil {
			if cdata.NotifyProps.Desktop != nil {
				member.NotifyProps[model.DESKTOP_NOTIFY_PROP] = *cdata.NotifyProps.Desktop
			}

			if cdata.NotifyProps.Mobile != nil {
				member.NotifyProps[model.PUSH_NOTIFY_PROP] = *cdata.NotifyProps.Mobile
			}

			if cdata.NotifyProps.MarkUnread != nil {
				member.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] = *cdata.NotifyProps.MarkUnread
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

	oldMembers, nErr := a.Srv().Store.Channel().UpdateMultipleMembers(oldChannelMembers)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return appErr
		case errors.As(nErr, &nfErr):
			return model.NewAppError("importUserChannels", MissingChannelMemberError, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return model.NewAppError("importUserChannels", "app.channel.get_member.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	newMembers := []*model.ChannelMember{}
	if len(newChannelMembers) > 0 {
		newMembers, nErr = a.Srv().Store.Channel().SaveMultipleMembers(newChannelMembers)
		if nErr != nil {
			var cErr *store.ErrConflict
			var appErr *model.AppError
			switch {
			case errors.As(nErr, &cErr):
				switch cErr.Resource {
				case "ChannelMembers":
					return model.NewAppError("importUserChannels", "app.channel.save_member.exists.app_error", nil, cErr.Error(), http.StatusBadRequest)
				}
			case errors.As(nErr, &appErr):
				return appErr
			default:
				return model.NewAppError("importUserChannels", "app.channel.create_direct_channel.internal_error", nil, nErr.Error(), http.StatusInternalServerError)
			}
		}
	}

	for _, member := range append(newMembers, oldMembers...) {
		if member.ExplicitRoles != rolesByChannelId[member.ChannelId] {
			if _, err = a.UpdateChannelMemberRoles(member.ChannelId, user.Id, rolesByChannelId[member.ChannelId]); err != nil {
				return err
			}
		}

		a.UpdateChannelMemberSchemeRoles(member.ChannelId, user.Id, isGuestByChannelId[member.ChannelId], isUserByChannelId[member.ChannelId], isAdminByChannelId[member.ChannelId])
	}

	for _, channel := range allChannels {
		if len(channelPreferencesByID[channel.Id]) > 0 {
			pref := channelPreferencesByID[channel.Id]
			if err := a.Srv().Store.Preference().Save(&pref); err != nil {
				return model.NewAppError("BulkImport", "app.import.import_user_channels.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	return nil
}

func (a *App) importReaction(data *ReactionImportData, post *model.Post) *model.AppError {
	if err := validateReactionImportData(data, post.CreateAt); err != nil {
		return err
	}

	var user *model.User
	var nErr error
	if user, nErr = a.Srv().Store.User().GetByUsername(*data.User); nErr != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": data.User}, nErr.Error(), http.StatusBadRequest)
	}

	reaction := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: *data.EmojiName,
		CreateAt:  *data.CreateAt,
	}
	if _, nErr = a.Srv().Store.Reaction().Save(reaction); nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("importReaction", "app.reaction.save.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) importReplies(data []ReplyImportData, post *model.Post, teamID string) *model.AppError {
	var err *model.AppError
	usernames := []string{}
	for _, replyData := range data {
		replyData := replyData
		if err = validateReplyImportData(&replyData, post.CreateAt, a.MaxPostSize()); err != nil {
			return err
		}
		usernames = append(usernames, *replyData.User)
	}

	users, err := a.getUsersByUsernames(usernames)
	if err != nil {
		return err
	}

	postsWithData := []postAndData{}
	postsForCreateList := []*model.Post{}
	postsForOverwriteList := []*model.Post{}

	for _, replyData := range data {
		replyData := replyData
		user := users[*replyData.User]

		// Check if this post already exists.
		replies, nErr := a.Srv().Store.Post().GetPostsCreatedAt(post.ChannelId, *replyData.CreateAt)
		if nErr != nil {
			return model.NewAppError("importReplies", "app.post.get_posts_created_at.app_error", nil, nErr.Error(), http.StatusInternalServerError)
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
		reply.ParentId = post.Id
		reply.RootId = post.Id
		reply.Message = *replyData.Message
		reply.CreateAt = *replyData.CreateAt

		fileIDs, err := a.uploadAttachments(replyData.Attachments, reply, teamID)
		if err != nil {
			return err
		}
		for _, fileID := range reply.FileIds {
			if _, ok := fileIDs[fileID]; !ok {
				a.Srv().Store.FileInfo().PermanentDelete(fileID)
			}
		}
		reply.FileIds = make([]string, 0)
		for fileID := range fileIDs {
			reply.FileIds = append(reply.FileIds, fileID)
		}

		if reply.Id == "" {
			postsForCreateList = append(postsForCreateList, reply)
		} else {
			postsForOverwriteList = append(postsForOverwriteList, reply)
		}
		postsWithData = append(postsWithData, postAndData{post: reply, replyData: &replyData})
	}

	if len(postsForCreateList) > 0 {
		if _, _, err := a.Srv().Store.Post().SaveMultiple(postsForCreateList); err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &appErr):
				return appErr
			case errors.As(err, &invErr):
				return model.NewAppError("importReplies", "app.post.save.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				return model.NewAppError("importReplies", "app.post.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if _, _, nErr := a.Srv().Store.Post().OverwriteMultiple(postsForOverwriteList); nErr != nil {
		return model.NewAppError("importReplies", "app.post.overwrite.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	for _, postWithData := range postsWithData {
		a.updateFileInfoWithPostId(postWithData.post)
	}

	return nil
}

func (a *App) importAttachment(data *AttachmentImportData, post *model.Post, teamID string) (*model.FileInfo, *model.AppError) {
	file, err := os.Open(*data.Path)
	if file == nil || err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.attachment.bad_file.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
	}
	defer file.Close()

	timestamp := utils.TimeFromMillis(post.CreateAt)

	fileData, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.attachment.read_file_data.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
	}

	// Go over existing files in the post and see if there already exists a file with the same name, size and hash. If so - skip it
	if post.Id != "" {
		oldFiles, err := a.GetFileInfosForPost(post.Id, true)
		if err != nil {
			return nil, model.NewAppError("BulkImport", "app.import.attachment.file_upload.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
		}
		for _, oldFile := range oldFiles {
			if oldFile.Name != path.Base(file.Name()) || oldFile.Size != int64(len(fileData)) {
				continue
			}
			// check md5
			newHash := sha1.Sum(fileData)
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

	mlog.Info("Uploading file with name", mlog.String("file_name", file.Name()))

	fileInfo, appErr := a.DoUploadFile(timestamp, teamID, post.ChannelId, post.UserId, file.Name(), fileData)
	if appErr != nil {
		mlog.Error("Failed to upload file:", mlog.Err(appErr))
		return nil, appErr
	}

	if fileInfo.IsImage() {
		a.HandleImages([]string{fileInfo.PreviewPath}, []string{fileInfo.ThumbnailPath}, [][]byte{fileData})
	}

	return fileInfo, nil
}

type postAndData struct {
	post           *model.Post
	postData       *PostImportData
	directPostData *DirectPostImportData
	replyData      *ReplyImportData
	team           *model.Team
	lineNumber     int
}

func (a *App) getUsersByUsernames(usernames []string) (map[string]*model.User, *model.AppError) {
	uniqueUsernames := utils.RemoveDuplicatesFromStringArray(usernames)
	allUsers, err := a.Srv().Store.User().GetProfilesByUsernames(uniqueUsernames, nil)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.get_users_by_username.some_users_not_found.error", nil, err.Error(), http.StatusBadRequest)
	}

	if len(allUsers) != len(uniqueUsernames) {
		return nil, model.NewAppError("BulkImport", "app.import.get_users_by_username.some_users_not_found.error", nil, "", http.StatusBadRequest)
	}

	users := make(map[string]*model.User)
	for _, user := range allUsers {
		users[user.Username] = user
	}
	return users, nil
}

func (a *App) getTeamsByNames(names []string) (map[string]*model.Team, *model.AppError) {
	allTeams, err := a.Srv().Store.Team().GetByNames(names)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.get_teams_by_names.some_teams_not_found.error", nil, err.Error(), http.StatusBadRequest)
	}

	teams := make(map[string]*model.Team)
	for _, team := range allTeams {
		teams[team.Name] = team
	}
	return teams, nil
}

func (a *App) getChannelsByNames(names []string, teamID string) (map[string]*model.Channel, *model.AppError) {
	allChannels, err := a.Srv().Store.Channel().GetByNames(teamID, names, true)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.get_teams_by_names.some_teams_not_found.error", nil, err.Error(), http.StatusBadRequest)
	}

	channels := make(map[string]*model.Channel)
	for _, channel := range allChannels {
		channels[channel.Name] = channel
	}
	return channels, nil
}

// getChannelsForPosts returns map[teamName]map[channelName]*model.Channel
func (a *App) getChannelsForPosts(teams map[string]*model.Team, data []*PostImportData) (map[string]map[string]*model.Channel, *model.AppError) {
	teamChannels := make(map[string]map[string]*model.Channel)
	for _, postData := range data {
		teamName := *postData.Team
		if _, ok := teamChannels[teamName]; !ok {
			teamChannels[teamName] = make(map[string]*model.Channel)
		}
		if channel, ok := teamChannels[teamName][*postData.Channel]; !ok || channel == nil {
			var err error
			channel, err = a.Srv().Store.Channel().GetByName(teams[teamName].Id, *postData.Channel, true)
			if err != nil {
				return nil, model.NewAppError("BulkImport", "app.import.import_post.channel_not_found.error", map[string]interface{}{"ChannelName": *postData.Channel}, err.Error(), http.StatusBadRequest)
			}
			teamChannels[teamName][*postData.Channel] = channel
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
func (a *App) importMultiplePostLines(lines []LineImportWorkerData, dryRun bool) (int, *model.AppError) {
	if len(lines) == 0 {
		return 0, nil
	}

	for _, line := range lines {
		if err := validatePostImportData(line.Post, a.MaxPostSize()); err != nil {
			return line.LineNumber, err
		}
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return 0, nil
	}

	usernames := []string{}
	teamNames := make([]string, len(lines))
	postsData := make([]*PostImportData, len(lines))
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
	postsWithData := []postAndData{}
	postsForCreateList := []*model.Post{}
	postsForCreateMap := map[string]int{}
	postsForOverwriteList := []*model.Post{}
	postsForOverwriteMap := map[string]int{}

	for _, line := range lines {
		team := teams[*line.Post.Team]
		channel := channels[*line.Post.Team][*line.Post.Channel]
		user := users[*line.Post.User]

		// Check if this post already exists.
		posts, nErr := a.Srv().Store.Post().GetPostsCreatedAt(channel.Id, *line.Post.CreateAt)
		if nErr != nil {
			return line.LineNumber, model.NewAppError("importMultiplePostLines", "app.post.get_posts_created_at.app_error", nil, nErr.Error(), http.StatusInternalServerError)
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

		if line.Post.Props != nil {
			post.Props = *line.Post.Props
		}

		fileIDs, appErr := a.uploadAttachments(line.Post.Attachments, post, team.Id)
		if appErr != nil {
			return line.LineNumber, appErr
		}
		for _, fileID := range post.FileIds {
			if _, ok := fileIDs[fileID]; !ok {
				a.Srv().Store.FileInfo().PermanentDelete(fileID)
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
		postsWithData = append(postsWithData, postAndData{post: post, postData: line.Post, team: team, lineNumber: line.LineNumber})
	}

	if len(postsForCreateList) > 0 {
		if _, idx, nErr := a.Srv().Store.Post().SaveMultiple(postsForCreateList); nErr != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			var retErr *model.AppError
			switch {
			case errors.As(nErr, &appErr):
				retErr = appErr
			case errors.As(nErr, &invErr):
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
			}

			if idx != -1 && idx < len(postsForCreateList) {
				post := postsForCreateList[idx]
				if lineNumber, ok := postsForCreateMap[getPostStrID(post)]; ok {
					return lineNumber, retErr
				}
			}
			return 0, retErr
		}
	}

	if _, idx, err := a.Srv().Store.Post().OverwriteMultiple(postsForOverwriteList); err != nil {
		if idx != -1 && idx < len(postsForOverwriteList) {
			post := postsForOverwriteList[idx]
			if lineNumber, ok := postsForOverwriteMap[getPostStrID(post)]; ok {
				return lineNumber, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
		return 0, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, postWithData := range postsWithData {
		postWithData := postWithData
		if postWithData.postData.FlaggedBy != nil {
			var preferences model.Preferences

			for _, username := range *postWithData.postData.FlaggedBy {
				user := users[username]

				preferences = append(preferences, model.Preference{
					UserId:   user.Id,
					Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
					Name:     postWithData.post.Id,
					Value:    "true",
				})
			}

			if len(preferences) > 0 {
				if err := a.Srv().Store.Preference().Save(&preferences); err != nil {
					return postWithData.lineNumber, model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
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
			err := a.importReplies(*postWithData.postData.Replies, postWithData.post, postWithData.team.Id)
			if err != nil {
				return postWithData.lineNumber, err
			}
		}
		a.updateFileInfoWithPostId(postWithData.post)
	}
	return 0, nil
}

// uploadAttachments imports new attachments and returns current attachments of the post as a map
func (a *App) uploadAttachments(attachments *[]AttachmentImportData, post *model.Post, teamID string) (map[string]bool, *model.AppError) {
	if attachments == nil {
		return nil, nil
	}
	fileIDs := make(map[string]bool)
	for _, attachment := range *attachments {
		attachment := attachment
		fileInfo, err := a.importAttachment(&attachment, post, teamID)
		if err != nil {
			return nil, err
		}
		fileIDs[fileInfo.Id] = true
	}
	return fileIDs, nil
}

func (a *App) updateFileInfoWithPostId(post *model.Post) {
	for _, fileID := range post.FileIds {
		if err := a.Srv().Store.FileInfo().AttachToPost(fileID, post.Id, post.UserId); err != nil {
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

	var userIDs []string
	userMap, err := a.getUsersByUsernames(*data.Members)
	if err != nil {
		return err
	}
	for _, user := range *data.Members {
		userIDs = append(userIDs, userMap[user].Id)
	}

	var channel *model.Channel

	if len(userIDs) == 2 {
		ch, err := a.createDirectChannel(userIDs[0], userIDs[1])
		if err != nil && err.Id != store.ChannelExistsError {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_direct_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	} else {
		ch, err := a.createGroupChannel(userIDs)
		if err != nil && err.Id != store.ChannelExistsError {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_group_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	}

	var preferences model.Preferences

	for _, userID := range userIDs {
		preferences = append(preferences, model.Preference{
			UserId:   userID,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     channel.Id,
			Value:    "true",
		})
	}

	if data.FavoritedBy != nil {
		for _, favoriter := range *data.FavoritedBy {
			preferences = append(preferences, model.Preference{
				UserId:   userMap[favoriter].Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			})
		}
	}

	if err := a.Srv().Store.Preference().Save(&preferences); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			appErr.StatusCode = http.StatusBadRequest
			return appErr
		default:
			return model.NewAppError("importDirectChannel", "app.preference.save.updating.app_error", nil, err.Error(), http.StatusBadRequest)
		}
	}

	if data.Header != nil {
		channel.Header = *data.Header
		if _, appErr := a.Srv().Store.Channel().Update(channel); appErr != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.update_header_failed.error", nil, appErr.Error(), http.StatusBadRequest)
		}
	}

	return nil
}

// importMultipleDirectPostLines will return an error and the line
// that caused it whenever possible
func (a *App) importMultipleDirectPostLines(lines []LineImportWorkerData, dryRun bool) (int, *model.AppError) {
	if len(lines) == 0 {
		return 0, nil
	}

	for _, line := range lines {
		if err := validateDirectPostImportData(line.DirectPost, a.MaxPostSize()); err != nil {
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

	postsWithData := []postAndData{}
	postsForCreateList := []*model.Post{}
	postsForCreateMap := map[string]int{}
	postsForOverwriteList := []*model.Post{}
	postsForOverwriteMap := map[string]int{}

	for _, line := range lines {
		var userIDs []string
		var err *model.AppError
		for _, username := range *line.DirectPost.ChannelMembers {
			user := users[username]
			userIDs = append(userIDs, user.Id)
		}

		var channel *model.Channel
		var ch *model.Channel
		if len(userIDs) == 2 {
			ch, err = a.GetOrCreateDirectChannel(userIDs[0], userIDs[1])
			if err != nil && err.Id != store.ChannelExistsError {
				return line.LineNumber, model.NewAppError("BulkImport", "app.import.import_direct_post.create_direct_channel.error", nil, err.Error(), http.StatusBadRequest)
			}
			channel = ch
		} else {
			ch, err = a.createGroupChannel(userIDs)
			if err != nil && err.Id != store.ChannelExistsError {
				return line.LineNumber, model.NewAppError("BulkImport", "app.import.import_direct_post.create_group_channel.error", nil, err.Error(), http.StatusBadRequest)
			}
			channel = ch
		}

		user := users[*line.DirectPost.User]

		// Check if this post already exists.
		posts, nErr := a.Srv().Store.Post().GetPostsCreatedAt(channel.Id, *line.DirectPost.CreateAt)
		if nErr != nil {
			return line.LineNumber, model.NewAppError("BulkImport", "app.post.get_posts_created_at.app_error", nil, nErr.Error(), http.StatusInternalServerError)
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

		if line.DirectPost.Props != nil {
			post.Props = *line.DirectPost.Props
		}

		fileIDs, err := a.uploadAttachments(line.DirectPost.Attachments, post, "noteam")
		if err != nil {
			return line.LineNumber, err
		}
		for _, fileID := range post.FileIds {
			if _, ok := fileIDs[fileID]; !ok {
				a.Srv().Store.FileInfo().PermanentDelete(fileID)
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
		if _, idx, err := a.Srv().Store.Post().SaveMultiple(postsForCreateList); err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			var retErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				retErr = appErr
			case errors.As(err, &invErr):
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				retErr = model.NewAppError("importMultiplePostLines", "app.post.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}

			if idx != -1 && idx < len(postsForCreateList) {
				post := postsForCreateList[idx]
				if lineNumber, ok := postsForCreateMap[getPostStrID(post)]; ok {
					return lineNumber, retErr
				}
			}
			return 0, retErr
		}
	}
	if _, idx, err := a.Srv().Store.Post().OverwriteMultiple(postsForOverwriteList); err != nil {
		if idx != -1 && idx < len(postsForOverwriteList) {
			post := postsForOverwriteList[idx]
			if lineNumber, ok := postsForOverwriteMap[getPostStrID(post)]; ok {
				return lineNumber, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
		return 0, model.NewAppError("importMultiplePostLines", "app.post.overwrite.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, postWithData := range postsWithData {
		if postWithData.directPostData.FlaggedBy != nil {
			var preferences model.Preferences

			for _, username := range *postWithData.directPostData.FlaggedBy {
				user := users[username]

				preferences = append(preferences, model.Preference{
					UserId:   user.Id,
					Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
					Name:     postWithData.post.Id,
					Value:    "true",
				})
			}

			if len(preferences) > 0 {
				if err := a.Srv().Store.Preference().Save(&preferences); err != nil {
					return postWithData.lineNumber, model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, err.Error(), http.StatusInternalServerError)
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
			if err := a.importReplies(*postWithData.directPostData.Replies, postWithData.post, "noteam"); err != nil {
				return postWithData.lineNumber, err
			}
		}

		a.updateFileInfoWithPostId(postWithData.post)
	}
	return 0, nil
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

	emoji, err := a.Srv().Store.Emoji().GetByName(context.Background(), *data.Name, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("importEmoji", "app.emoji.get_by_name.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
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
	defer file.Close()

	if _, err := a.WriteFile(file, getEmojiImagePath(emoji.Id)); err != nil {
		return err
	}

	if !alreadyExists {
		if _, err := a.Srv().Store.Emoji().Save(emoji); err != nil {
			return model.NewAppError("importEmoji", "api.emoji.create.internal_error", nil, err.Error(), http.StatusBadRequest)
		}
	}

	return nil
}
