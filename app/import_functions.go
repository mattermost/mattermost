// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

//
// -- Bulk Import Functions --
// These functions import data directly into the database. Security and permission checks are bypassed but validity is
// still enforced.
//

func (a *App) ImportScheme(data *SchemeImportData, dryRun bool) *model.AppError {
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
		if err := a.ImportRole(data.DefaultTeamAdminRole, dryRun, true); err != nil {
			return err
		}

		data.DefaultTeamUserRole.Name = &scheme.DefaultTeamUserRole
		if err := a.ImportRole(data.DefaultTeamUserRole, dryRun, true); err != nil {
			return err
		}
	}

	if scheme.Scope == model.SCHEME_SCOPE_TEAM || scheme.Scope == model.SCHEME_SCOPE_CHANNEL {
		data.DefaultChannelAdminRole.Name = &scheme.DefaultChannelAdminRole
		if err := a.ImportRole(data.DefaultChannelAdminRole, dryRun, true); err != nil {
			return err
		}

		data.DefaultChannelUserRole.Name = &scheme.DefaultChannelUserRole
		if err := a.ImportRole(data.DefaultChannelUserRole, dryRun, true); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) ImportRole(data *RoleImportData, dryRun bool, isSchemeRole bool) *model.AppError {
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

func (a *App) ImportTeam(data *TeamImportData, dryRun bool) *model.AppError {
	if err := validateTeamImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var team *model.Team
	if result := <-a.Srv.Store.Team().GetByName(*data.Name); result.Err == nil {
		team = result.Data.(*model.Team)
	} else {
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

func (a *App) ImportChannel(data *ChannelImportData, dryRun bool) *model.AppError {
	if err := validateChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	result := <-a.Srv.Store.Team().GetByName(*data.Team)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_channel.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, result.Err.Error(), http.StatusBadRequest)
	}
	team := result.Data.(*model.Team)

	var channel *model.Channel
	if result := <-a.Srv.Store.Channel().GetByNameIncludeDeleted(team.Id, *data.Name, true); result.Err == nil {
		channel = result.Data.(*model.Channel)
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

func (a *App) ImportUser(data *UserImportData, dryRun bool) *model.AppError {
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
	if result := <-a.Srv.Store.User().GetByUsername(*data.Username); result.Err == nil {
		user = result.Data.(*model.User)
	} else {
		user = &model.User{}
		user.MakeNonNil()
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
		password = model.NewId()
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
		}
	}

	var err *model.AppError
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
				if res := <-a.Srv.Store.User().UpdateAuthData(user.Id, authService, authData, user.Email, false); res.Err != nil {
					return res.Err
				}
			}
		}
		if emailVerified {
			if hasUserEmailVerifiedChanged {
				if err := a.VerifyUserEmail(user.Id); err != nil {
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
		if err := a.SetProfileImageFromFile(savedUser.Id, file); err != nil {
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

	if len(preferences) > 0 {
		if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user.save_preferences.error", nil, result.Err.Error(), http.StatusInternalServerError)
		}
	}

	return a.ImportUserTeams(savedUser, data.Teams)
}

func (a *App) ImportUserTeams(user *model.User, data *[]UserTeamImportData) *model.AppError {
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
		isSchemeUser := true
		isSchemeAdmin := false

		if tdata.Roles == nil {
			isSchemeUser = true
		} else {
			rawRoles := *tdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.TEAM_USER_ROLE_ID {
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
			if _, err := a.UpdateTeamMemberRoles(team.Id, user.Id, roles); err != nil {
				return err
			}
		}

		if member.SchemeAdmin != isSchemeAdmin || member.SchemeUser != isSchemeUser {
			a.UpdateTeamMemberSchemeRoles(team.Id, user.Id, isSchemeUser, isSchemeAdmin)
		}

		defaultChannel, err := a.GetChannelByName(model.DEFAULT_CHANNEL, team.Id, true)
		if err != nil {
			return err
		}

		if _, err = a.addUserToChannel(user, defaultChannel, member); err != nil {
			return err
		}

		if err := a.ImportUserChannels(user, team, member, tdata.Channels); err != nil {
			return err
		}
	}

	if len(teamThemePreferences) > 0 {
		if result := <-a.Srv.Store.Preference().Save(&teamThemePreferences); result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user_teams.save_preferences.error", nil, result.Err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) ImportUserChannels(user *model.User, team *model.Team, teamMember *model.TeamMember, data *[]UserChannelImportData) *model.AppError {
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
		isSchemeUser := true
		isSchemeAdmin := false

		if cdata.Roles == nil {
			isSchemeUser = true
		} else {
			rawRoles := *cdata.Roles
			explicitRoles := []string{}
			for _, role := range strings.Fields(rawRoles) {
				if role == model.CHANNEL_USER_ROLE_ID {
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

		if member.SchemeAdmin != isSchemeAdmin || member.SchemeUser != isSchemeUser {
			a.UpdateChannelMemberSchemeRoles(channel.Id, user.Id, isSchemeUser, isSchemeAdmin)
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
		if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user_channels.save_preferences.error", nil, result.Err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) ImportReaction(data *ReactionImportData, post *model.Post, dryRun bool) *model.AppError {
	if err := validateReactionImportData(data, post.CreateAt); err != nil {
		return err
	}

	result := <-a.Srv.Store.User().GetByUsername(*data.User)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": data.User}, result.Err.Error(), http.StatusBadRequest)
	}
	user := result.Data.(*model.User)

	reaction := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: *data.EmojiName,
		CreateAt:  *data.CreateAt,
	}
	if result := <-a.Srv.Store.Reaction().Save(reaction); result.Err != nil {
		return result.Err
	}
	return nil
}

func (a *App) ImportReply(data *ReplyImportData, post *model.Post, teamId string, dryRun bool) *model.AppError {
	if err := validateReplyImportData(data, post.CreateAt, a.MaxPostSize()); err != nil {
		return err
	}

	result := <-a.Srv.Store.User().GetByUsername(*data.User)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": data.User}, result.Err.Error(), http.StatusBadRequest)
	}
	user := result.Data.(*model.User)

	// Check if this post already exists.
	result = <-a.Srv.Store.Post().GetPostsCreatedAt(post.ChannelId, *data.CreateAt)
	if result.Err != nil {
		return result.Err
	}
	replies := result.Data.([]*model.Post)

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

	if data.Attachments != nil {
		fileIds, err := a.uploadAttachments(data.Attachments, reply, teamId, dryRun)
		if err != nil {
			return err
		}
		reply.FileIds = append(reply.FileIds, fileIds...)
	}

	if reply.Id == "" {
		if result := <-a.Srv.Store.Post().Save(reply); result.Err != nil {
			return result.Err
		}
	} else {
		if result := <-a.Srv.Store.Post().Overwrite(reply); result.Err != nil {
			return result.Err
		}
	}

	a.UpdateFileInfoWithPostId(reply)

	return nil
}

func (a *App) ImportAttachment(data *AttachmentImportData, post *model.Post, teamId string, dryRun bool) (*model.FileInfo, *model.AppError) {
	fileUploadError := model.NewAppError("BulkImport", "app.import.attachment.file_upload.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
	file, err := os.Open(*data.Path)
	if err != nil {
		return nil, model.NewAppError("BulkImport", "app.import.attachment.bad_file.error", map[string]interface{}{"FilePath": *data.Path}, "", http.StatusBadRequest)
	}
	if file != nil {
		timestamp := utils.TimeFromMillis(post.CreateAt)
		buf := bytes.NewBuffer(nil)
		io.Copy(buf, file)

		fileInfo, err := a.DoUploadFile(timestamp, teamId, post.ChannelId, post.UserId, file.Name(), buf.Bytes())

		if err != nil {
			fmt.Print(err)
			return nil, fileUploadError
		}

		a.HandleImages([]string{fileInfo.PreviewPath}, []string{fileInfo.ThumbnailPath}, [][]byte{buf.Bytes()})

		mlog.Info(fmt.Sprintf("uploading file with name %s", file.Name()))
		return fileInfo, nil
	}
	return nil, fileUploadError
}

func (a *App) ImportPost(data *PostImportData, dryRun bool) *model.AppError {
	if err := validatePostImportData(data, a.MaxPostSize()); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	result := <-a.Srv.Store.Team().GetByName(*data.Team)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, result.Err.Error(), http.StatusBadRequest)
	}
	team := result.Data.(*model.Team)

	result = <-a.Srv.Store.Channel().GetByName(team.Id, *data.Channel, false)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.channel_not_found.error", map[string]interface{}{"ChannelName": *data.Channel}, result.Err.Error(), http.StatusBadRequest)
	}
	channel := result.Data.(*model.Channel)

	result = <-a.Srv.Store.User().GetByUsername(*data.User)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, result.Err.Error(), http.StatusBadRequest)
	}
	user := result.Data.(*model.User)

	// Check if this post already exists.
	result = <-a.Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt)
	if result.Err != nil {
		return result.Err
	}
	posts := result.Data.([]*model.Post)

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

	if data.Attachments != nil {
		fileIds, err := a.uploadAttachments(data.Attachments, post, team.Id, dryRun)
		if err != nil {
			return err
		}
		post.FileIds = append(post.FileIds, fileIds...)
	}

	if post.Id == "" {
		if result := <-a.Srv.Store.Post().Save(post); result.Err != nil {
			return result.Err
		}
	} else {
		if result := <-a.Srv.Store.Post().Overwrite(post); result.Err != nil {
			return result.Err
		}
	}

	if data.FlaggedBy != nil {
		var preferences model.Preferences

		for _, username := range *data.FlaggedBy {
			result := <-a.Srv.Store.User().GetByUsername(username)
			if result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": username}, result.Err.Error(), http.StatusBadRequest)
			}
			user := result.Data.(*model.User)

			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
				Name:     post.Id,
				Value:    "true",
			})
		}

		if len(preferences) > 0 {
			if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, result.Err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if data.Reactions != nil {
		for _, reaction := range *data.Reactions {
			if err := a.ImportReaction(&reaction, post, dryRun); err != nil {
				return err
			}
		}
	}

	if data.Replies != nil {
		for _, reply := range *data.Replies {
			if err := a.ImportReply(&reply, post, team.Id, dryRun); err != nil {
				return err
			}
		}
	}

	a.UpdateFileInfoWithPostId(post)
	return nil
}

func (a *App) uploadAttachments(attachments *[]AttachmentImportData, post *model.Post, teamId string, dryRun bool) ([]string, *model.AppError) {
	fileIds := []string{}
	for _, attachment := range *attachments {
		fileInfo, err := a.ImportAttachment(&attachment, post, teamId, dryRun)
		if err != nil {
			return nil, err
		}
		fileIds = append(fileIds, fileInfo.Id)
	}
	return fileIds, nil
}

func (a *App) UpdateFileInfoWithPostId(post *model.Post) {
	for _, fileId := range post.FileIds {
		if result := <-a.Srv.Store.FileInfo().AttachToPost(fileId, post.Id); result.Err != nil {
			mlog.Error(fmt.Sprintf("Error attaching files to post. postId=%v, fileIds=%v, message=%v", post.Id, post.FileIds, result.Err), mlog.String("post_id", post.Id))
		}
	}
}
func (a *App) ImportDirectChannel(data *DirectChannelImportData, dryRun bool) *model.AppError {
	if err := validateDirectChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var userIds []string
	userMap := make(map[string]string)
	for _, username := range *data.Members {
		result := <-a.Srv.Store.User().GetByUsername(username)
		if result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.member_not_found.error", nil, result.Err.Error(), http.StatusBadRequest)
		}
		user := result.Data.(*model.User)
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

	if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return result.Err
	}

	if data.Header != nil {
		channel.Header = *data.Header
		if result := <-a.Srv.Store.Channel().Update(channel); result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.update_header_failed.error", nil, result.Err.Error(), http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) ImportDirectPost(data *DirectPostImportData, dryRun bool) *model.AppError {
	if err := validateDirectPostImportData(data, a.MaxPostSize()); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var userIds []string
	for _, username := range *data.ChannelMembers {
		result := <-a.Srv.Store.User().GetByUsername(username)
		if result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.channel_member_not_found.error", nil, result.Err.Error(), http.StatusBadRequest)
		}
		user := result.Data.(*model.User)
		userIds = append(userIds, user.Id)
	}

	var channel *model.Channel
	if len(userIds) == 2 {
		ch, err := a.createDirectChannel(userIds[0], userIds[1])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.create_direct_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	} else {
		ch, err := a.createGroupChannel(userIds, userIds[0])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.create_group_channel.error", nil, err.Error(), http.StatusBadRequest)
		}
		channel = ch
	}

	result := <-a.Srv.Store.User().GetByUsername(*data.User)
	if result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_direct_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, "", http.StatusBadRequest)
	}
	user := result.Data.(*model.User)

	// Check if this post already exists.
	result = <-a.Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt)
	if result.Err != nil {
		return result.Err
	}
	posts := result.Data.([]*model.Post)

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

	if data.Attachments != nil {
		fileIds, err := a.uploadAttachments(data.Attachments, post, "noteam", dryRun)
		if err != nil {
			return err
		}
		post.FileIds = append(post.FileIds, fileIds...)
	}

	if post.Id == "" {
		if result := <-a.Srv.Store.Post().Save(post); result.Err != nil {
			return result.Err
		}
	} else {
		if result := <-a.Srv.Store.Post().Overwrite(post); result.Err != nil {
			return result.Err
		}
	}

	if data.FlaggedBy != nil {
		var preferences model.Preferences

		for _, username := range *data.FlaggedBy {
			result := <-a.Srv.Store.User().GetByUsername(username)
			if result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_direct_post.user_not_found.error", map[string]interface{}{"Username": username}, "", http.StatusBadRequest)
			}
			user := result.Data.(*model.User)

			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
				Name:     post.Id,
				Value:    "true",
			})
		}

		if len(preferences) > 0 {
			if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_direct_post.save_preferences.error", nil, result.Err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if data.Reactions != nil {
		for _, reaction := range *data.Reactions {
			if err := a.ImportReaction(&reaction, post, dryRun); err != nil {
				return err
			}
		}
	}

	if data.Replies != nil {
		for _, reply := range *data.Replies {
			if err := a.ImportReply(&reply, post, "noteam", dryRun); err != nil {
				return err
			}
		}
	}

	a.UpdateFileInfoWithPostId(post)
	return nil
}

func (a *App) ImportEmoji(data *EmojiImportData, dryRun bool) *model.AppError {
	if err := validateEmojiImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var emoji *model.Emoji

	result := <-a.Srv.Store.Emoji().GetByName(*data.Name)
	if result.Err != nil && result.Err.StatusCode != http.StatusNotFound {
		return result.Err
	}

	if result.Data != nil {
		emoji = result.Data.(*model.Emoji)
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
		if result := <-a.Srv.Store.Emoji().Save(emoji); result.Err != nil {
			return result.Err
		}
	}

	return nil
}
