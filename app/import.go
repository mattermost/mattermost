// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

// Import Data Models

type LineImportData struct {
	Type    string             `json:"type"`
	Team    *TeamImportData    `json:"team"`
	Channel *ChannelImportData `json:"channel"`
	User    *UserImportData    `json:"user"`
	Post    *PostImportData    `json:"post"`
	Version *int               `json:"version"`
}

type TeamImportData struct {
	Name            *string `json:"name"`
	DisplayName     *string `json:"display_name"`
	Type            *string `json:"type"`
	Description     *string `json:"description"`
	AllowOpenInvite *bool   `json:"allow_open_invite"`
}

type ChannelImportData struct {
	Team        *string `json:"team"`
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Type        *string `json:"type"`
	Header      *string `json:"header"`
	Purpose     *string `json:"purpose"`
}

type UserImportData struct {
	Username    *string `json:"username"`
	Email       *string `json:"email"`
	AuthService *string `json:"auth_service"`
	AuthData    *string `json:"auth_data"`
	Nickname    *string `json:"nickname"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Position    *string `json:"position"`
	Roles       *string `json:"roles"`
	Locale      *string `json:"locale"`

	Teams *[]UserTeamImportData `json:"teams"`

	Theme              *string `json:"theme"`
	SelectedFont       *string `json:"display_font"`
	UseMilitaryTime    *string `json:"military_time"`
	NameFormat         *string `json:"teammate_name_display"`
	CollapsePreviews   *string `json:"link_previews"`
	MessageDisplay     *string `json:"message_display"`
	ChannelDisplayMode *string `json:"channel_display_mode"`
}

type UserTeamImportData struct {
	Name     *string                  `json:"name"`
	Roles    *string                  `json:"roles"`
	Channels *[]UserChannelImportData `json:"channels"`
}

type UserChannelImportData struct {
	Name        *string                           `json:"name"`
	Roles       *string                           `json:"roles"`
	NotifyProps *UserChannelNotifyPropsImportData `json:"notify_props"`
}

type UserChannelNotifyPropsImportData struct {
	Desktop    *string `json:"desktop"`
	MarkUnread *string `json:"mark_unread"`
}

type PostImportData struct {
	Team    *string `json:"team"`
	Channel *string `json:"channel"`
	User    *string `json:"user"`

	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`
}

//
// -- Bulk Import Functions --
// These functions import data directly into the database. Security and permission checks are bypassed but validity is
// still enforced.
//

func BulkImport(fileReader io.Reader, dryRun bool) (*model.AppError, int) {
	scanner := bufio.NewScanner(fileReader)
	lineNumber := 0
	for scanner.Scan() {
		decoder := json.NewDecoder(strings.NewReader(scanner.Text()))
		lineNumber++

		var line LineImportData
		if err := decoder.Decode(&line); err != nil {
			return model.NewLocAppError("BulkImport", "app.import.bulk_import.json_decode.error", nil, err.Error()), lineNumber
		} else {
			if lineNumber == 1 {
				importDataFileVersion, apperr := processImportDataFileVersionLine(line)
				if apperr != nil {
					return apperr, lineNumber
				}

				if importDataFileVersion != 1 {
					return model.NewAppError("BulkImport", "app.import.bulk_import.unsupported_version.error", nil, "", http.StatusBadRequest), lineNumber
				}
			} else if err := ImportLine(line, dryRun); err != nil {
				return err, lineNumber
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return model.NewLocAppError("BulkImport", "app.import.bulk_import.file_scan.error", nil, err.Error()), 0
	}

	return nil, 0
}

func processImportDataFileVersionLine(line LineImportData) (int, *model.AppError) {
	if line.Type != "version" || line.Version == nil {
		return -1, model.NewAppError("BulkImport", "app.import.process_import_data_file_version_line.invalid_version.error", nil, "", http.StatusBadRequest)
	}

	return *line.Version, nil
}

func ImportLine(line LineImportData, dryRun bool) *model.AppError {
	switch {
	case line.Type == "team":
		if line.Team == nil {
			return model.NewLocAppError("BulkImport", "app.import.import_line.null_team.error", nil, "")
		} else {
			return ImportTeam(line.Team, dryRun)
		}
	case line.Type == "channel":
		if line.Channel == nil {
			return model.NewLocAppError("BulkImport", "app.import.import_line.null_channel.error", nil, "")
		} else {
			return ImportChannel(line.Channel, dryRun)
		}
	case line.Type == "user":
		if line.User == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_user.error", nil, "", http.StatusBadRequest)
		} else {
			return ImportUser(line.User, dryRun)
		}
	case line.Type == "post":
		if line.Post == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_post.error", nil, "", http.StatusBadRequest)
		} else {
			return ImportPost(line.Post, dryRun)
		}
	default:
		return model.NewLocAppError("BulkImport", "app.import.import_line.unknown_line_type.error", map[string]interface{}{"Type": line.Type}, "")
	}
}

func ImportTeam(data *TeamImportData, dryRun bool) *model.AppError {
	if err := validateTeamImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(*data.Name); result.Err == nil {
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

	if team.Id == "" {
		if _, err := CreateTeam(team); err != nil {
			return err
		}
	} else {
		if _, err := UpdateTeam(team); err != nil {
			return err
		}
	}

	return nil
}

func validateTeamImportData(data *TeamImportData) *model.AppError {

	if data.Name == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.name_missing.error", nil, "")
	} else if len(*data.Name) > model.TEAM_NAME_MAX_LENGTH {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.name_length.error", nil, "")
	} else if model.IsReservedTeamName(*data.Name) {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.name_reserved.error", nil, "")
	} else if !model.IsValidTeamName(*data.Name) {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.name_characters.error", nil, "")
	}

	if data.DisplayName == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.display_name_missing.error", nil, "")
	} else if utf8.RuneCountInString(*data.DisplayName) == 0 || utf8.RuneCountInString(*data.DisplayName) > model.TEAM_DISPLAY_NAME_MAX_RUNES {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.display_name_length.error", nil, "")
	}

	if data.Type == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.type_missing.error", nil, "")
	} else if *data.Type != model.TEAM_OPEN && *data.Type != model.TEAM_INVITE {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.type_invalid.error", nil, "")
	}

	if data.Description != nil && len(*data.Description) > model.TEAM_DESCRIPTION_MAX_LENGTH {
		return model.NewLocAppError("BulkImport", "app.import.validate_team_import_data.description_length.error", nil, "")
	}

	return nil
}

func ImportChannel(data *ChannelImportData, dryRun bool) *model.AppError {
	if err := validateChannelImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(*data.Team); result.Err != nil {
		return model.NewLocAppError("BulkImport", "app.import.import_channel.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, "")
	} else {
		team = result.Data.(*model.Team)
	}

	var channel *model.Channel
	if result := <-Srv.Store.Channel().GetByNameIncludeDeleted(team.Id, *data.Name, true); result.Err == nil {
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

	if channel.Id == "" {
		if _, err := CreateChannel(channel, false); err != nil {
			return err
		}
	} else {
		if _, err := UpdateChannel(channel); err != nil {
			return err
		}
	}

	return nil
}

func validateChannelImportData(data *ChannelImportData) *model.AppError {

	if data.Team == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.team_missing.error", nil, "")
	}

	if data.Name == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.name_missing.error", nil, "")
	} else if len(*data.Name) > model.CHANNEL_NAME_MAX_LENGTH {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.name_length.error", nil, "")
	} else if !model.IsValidChannelIdentifier(*data.Name) {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.name_characters.error", nil, "")
	}

	if data.DisplayName == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.display_name_missing.error", nil, "")
	} else if utf8.RuneCountInString(*data.DisplayName) == 0 || utf8.RuneCountInString(*data.DisplayName) > model.CHANNEL_DISPLAY_NAME_MAX_RUNES {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.display_name_length.error", nil, "")
	}

	if data.Type == nil {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.type_missing.error", nil, "")
	} else if *data.Type != model.CHANNEL_OPEN && *data.Type != model.CHANNEL_PRIVATE {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.type_invalid.error", nil, "")
	}

	if data.Header != nil && utf8.RuneCountInString(*data.Header) > model.CHANNEL_HEADER_MAX_RUNES {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.header_length.error", nil, "")
	}

	if data.Purpose != nil && utf8.RuneCountInString(*data.Purpose) > model.CHANNEL_PURPOSE_MAX_RUNES {
		return model.NewLocAppError("BulkImport", "app.import.validate_channel_import_data.purpose_length.error", nil, "")
	}

	return nil
}

func ImportUser(data *UserImportData, dryRun bool) *model.AppError {
	if err := validateUserImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByUsername(*data.Username); result.Err == nil {
		user = result.Data.(*model.User)
	} else {
		user = &model.User{}
	}

	user.Username = *data.Username
	user.Email = *data.Email

	var password string
	var authService string
	var authData *string

	if data.AuthService != nil {
		authService = *data.AuthService
	}

	// AuthData and Password are mutually exclusive.
	if data.AuthData != nil {
		authData = data.AuthData
		password = ""
	} else {
		// If no Auth Data is specified, we must generate a password.
		password = model.NewId()
		authData = nil
	}

	user.Password = password
	user.AuthService = authService
	user.AuthData = authData

	// Automatically assume all emails are verified.
	emailVerified := true
	user.EmailVerified = emailVerified

	if data.Nickname != nil {
		user.Nickname = *data.Nickname
	}

	if data.FirstName != nil {
		user.FirstName = *data.FirstName
	}

	if data.LastName != nil {
		user.LastName = *data.LastName
	}

	if data.Position != nil {
		user.Position = *data.Position
	}

	if data.Locale != nil {
		user.Locale = *data.Locale
	} else {
		user.Locale = *utils.Cfg.LocalizationSettings.DefaultClientLocale
	}

	var roles string
	if data.Roles != nil {
		roles = *data.Roles
	} else if len(user.Roles) == 0 {
		// Set SYSTEM_USER roles on newly created users by default.
		roles = model.ROLE_SYSTEM_USER.Id
	}
	user.Roles = roles

	if user.Id == "" {
		if _, err := createUser(user); err != nil {
			return err
		}
	} else {
		if _, err := UpdateUser(user, false); err != nil {
			return err
		}
		if _, err := UpdateUserRoles(user.Id, roles); err != nil {
			return err
		}
		if len(password) > 0 {
			if err := UpdatePassword(user, password); err != nil {
				return err
			}
		} else {
			if res := <-Srv.Store.User().UpdateAuthData(user.Id, authService, authData, user.Email, false); res.Err != nil {
				return res.Err
			}
		}
		if emailVerified {
			if err := VerifyUserEmail(user.Id); err != nil {
				return err
			}
		}
	}

	// Preferences.
	var preferences model.Preferences

	if data.Theme != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_THEME,
			Name:     "",
			Value:    *data.Theme,
		})
	}

	if data.SelectedFont != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "selected_font",
			Value:    *data.SelectedFont,
		})
	}

	if data.UseMilitaryTime != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "use_military_time",
			Value:    *data.UseMilitaryTime,
		})
	}

	if data.NameFormat != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "name_format",
			Value:    *data.NameFormat,
		})
	}

	if data.CollapsePreviews != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "collapse_previews",
			Value:    *data.CollapsePreviews,
		})
	}

	if data.MessageDisplay != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "message_display",
			Value:    *data.MessageDisplay,
		})
	}

	if data.ChannelDisplayMode != nil {
		preferences = append(preferences, model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "channel_display_mode",
			Value:    *data.ChannelDisplayMode,
		})
	}

	if len(preferences) > 0 {
		if result := <-Srv.Store.Preference().Save(&preferences); result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user.save_preferences.error", nil, "", http.StatusInternalServerError)
		}
	}

	return ImportUserTeams(*data.Username, data.Teams)
}

func ImportUserTeams(username string, data *[]UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	user, err := GetUserByUsername(username)
	if err != nil {
		return err
	}

	for _, tdata := range *data {
		team, err := GetTeamByName(*tdata.Name)
		if err != nil {
			return err
		}

		var roles string
		if tdata.Roles == nil {
			roles = model.ROLE_TEAM_USER.Id
		} else {
			roles = *tdata.Roles
		}

		if _, err := GetTeamMember(team.Id, user.Id); err != nil {
			if _, err := joinUserToTeam(team, user); err != nil {
				return err
			}
		}

		if member, err := GetTeamMember(team.Id, user.Id); err != nil {
			return err
		} else {
			if member.Roles != roles {
				if _, err := UpdateTeamMemberRoles(team.Id, user.Id, roles); err != nil {
					return err
				}
			}
		}

		if err := ImportUserChannels(user, team, tdata.Channels); err != nil {
			return err
		}
	}

	return nil
}

func ImportUserChannels(user *model.User, team *model.Team, data *[]UserChannelImportData) *model.AppError {
	if data == nil {
		return nil
	}

	// Loop through all channels.
	for _, cdata := range *data {
		channel, err := GetChannelByName(*cdata.Name, team.Id)
		if err != nil {
			return err
		}

		var roles string
		if cdata.Roles == nil {
			roles = model.ROLE_CHANNEL_USER.Id
		} else {
			roles = *cdata.Roles
		}

		var member *model.ChannelMember
		member, err = GetChannelMember(channel.Id, user.Id)
		if err != nil {
			member, err = addUserToChannel(user, channel)
			if err != nil {
				return err
			}
		}

		if member.Roles != roles {
			if _, err := UpdateChannelMemberRoles(channel.Id, user.Id, roles); err != nil {
				return err
			}
		}

		if cdata.NotifyProps != nil {
			notifyProps := member.NotifyProps

			if cdata.NotifyProps.Desktop != nil {
				notifyProps[model.DESKTOP_NOTIFY_PROP] = *cdata.NotifyProps.Desktop
			}

			if cdata.NotifyProps.MarkUnread != nil {
				notifyProps[model.MARK_UNREAD_NOTIFY_PROP] = *cdata.NotifyProps.MarkUnread
			}

			if _, err := UpdateChannelMemberNotifyProps(notifyProps, channel.Id, user.Id); err != nil {
				return err
			}
		}
	}

	return nil
}

func validateUserImportData(data *UserImportData) *model.AppError {

	if data.Username == nil {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.username_missing.error", nil, "", http.StatusBadRequest)
	} else if !model.IsValidUsername(*data.Username) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.username_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Email == nil {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.email_missing.error", nil, "", http.StatusBadRequest)
	} else if len(*data.Email) == 0 || len(*data.Email) > model.USER_EMAIL_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.email_length.error", nil, "", http.StatusBadRequest)
	}

	if data.AuthService != nil && len(*data.AuthService) == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_service_length.error", nil, "", http.StatusBadRequest)
	}

	if data.AuthData != nil && len(*data.AuthData) > model.USER_AUTH_DATA_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_data_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Nickname != nil && utf8.RuneCountInString(*data.Nickname) > model.USER_NICKNAME_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.nickname_length.error", nil, "", http.StatusBadRequest)
	}

	if data.FirstName != nil && utf8.RuneCountInString(*data.FirstName) > model.USER_FIRST_NAME_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.first_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.LastName != nil && utf8.RuneCountInString(*data.LastName) > model.USER_LAST_NAME_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.last_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Position != nil && utf8.RuneCountInString(*data.Position) > model.USER_POSITION_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.position_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Roles != nil && !model.IsValidUserRoles(*data.Roles) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.roles_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Teams != nil {
		return validateUserTeamsImportData(data.Teams)
	} else {
		return nil
	}
}

func validateUserTeamsImportData(data *[]UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	for _, tdata := range *data {
		if tdata.Name == nil {
			return model.NewAppError("BulkImport", "app.import.validate_user_teams_import_data.team_name_missing.error", nil, "", http.StatusBadRequest)
		}

		if tdata.Roles != nil && !model.IsValidUserRoles(*tdata.Roles) {
			return model.NewAppError("BulkImport", "app.import.validate_user_teams_import_data.invalid_roles.error", nil, "", http.StatusBadRequest)
		}

		if tdata.Channels != nil {
			if err := validateUserChannelsImportData(tdata.Channels); err != nil {
				return err
			}
		}
	}

	return nil
}

func validateUserChannelsImportData(data *[]UserChannelImportData) *model.AppError {
	if data == nil {
		return nil
	}

	for _, cdata := range *data {
		if cdata.Name == nil {
			return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.channel_name_missing.error", nil, "", http.StatusBadRequest)
		}

		if cdata.Roles != nil && !model.IsValidUserRoles(*cdata.Roles) {
			return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_roles.error", nil, "", http.StatusBadRequest)
		}

		if cdata.NotifyProps != nil {
			if cdata.NotifyProps.Desktop != nil && !model.IsChannelNotifyLevelValid(*cdata.NotifyProps.Desktop) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_desktop.error", nil, "", http.StatusBadRequest)
			}

			if cdata.NotifyProps.MarkUnread != nil && !model.IsChannelMarkUnreadLevelValid(*cdata.NotifyProps.MarkUnread) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_mark_unread.error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func ImportPost(data *PostImportData, dryRun bool) *model.AppError {
	if err := validatePostImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(*data.Team); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, "", http.StatusBadRequest)
	} else {
		team = result.Data.(*model.Team)
	}

	var channel *model.Channel
	if result := <-Srv.Store.Channel().GetByName(team.Id, *data.Channel, false); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.channel_not_found.error", map[string]interface{}{"ChannelName": *data.Channel}, "", http.StatusBadRequest)
	} else {
		channel = result.Data.(*model.Channel)
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByUsername(*data.User); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, "", http.StatusBadRequest)
	} else {
		user = result.Data.(*model.User)
	}

	// Check if this post already exists.
	var posts []*model.Post
	if result := <-Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt); result.Err != nil {
		return result.Err
	} else {
		posts = result.Data.([]*model.Post)
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

	if post.Id == "" {
		if result := <-Srv.Store.Post().Save(post); result.Err != nil {
			return result.Err
		}
	} else {
		if result := <-Srv.Store.Post().Overwrite(post); result.Err != nil {
			return result.Err
		}
	}

	return nil
}

func validatePostImportData(data *PostImportData) *model.AppError {
	if data.Team == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.team_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Channel == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.channel_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.User == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.user_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Message == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.message_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.Message) > model.POST_MESSAGE_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.message_length.error", nil, "", http.StatusBadRequest)
	}

	if data.CreateAt == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.create_at_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.create_at_zero.error", nil, "", http.StatusBadRequest)
	}

	return nil
}

//
// -- Old SlackImport Functions --
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func OldImportPost(post *model.Post) {
	// Workaround for empty messages, which may be the case if they are webhook posts.
	firstIteration := true
	for messageRuneCount := utf8.RuneCountInString(post.Message); messageRuneCount > 0 || firstIteration; messageRuneCount = utf8.RuneCountInString(post.Message) {
		firstIteration = false
		var remainder string
		if messageRuneCount > model.POST_MESSAGE_MAX_RUNES {
			remainder = string(([]rune(post.Message))[model.POST_MESSAGE_MAX_RUNES:])
			post.Message = truncateRunes(post.Message, model.POST_MESSAGE_MAX_RUNES)
		} else {
			remainder = ""
		}

		post.Hashtags, _ = model.ParseHashtags(post.Message)

		if result := <-Srv.Store.Post().Save(post); result.Err != nil {
			l4g.Debug(utils.T("api.import.import_post.saving.debug"), post.UserId, post.Message)
		}

		for _, fileId := range post.FileIds {
			if result := <-Srv.Store.FileInfo().AttachToPost(fileId, post.Id); result.Err != nil {
				l4g.Error(utils.T("api.import.import_post.attach_files.error"), post.Id, post.FileIds, result.Err)
			}
		}

		post.Id = ""
		post.CreateAt++
		post.Message = remainder
	}
}

func OldImportUser(team *model.Team, user *model.User) *model.User {
	user.MakeNonNil()

	user.Roles = model.ROLE_SYSTEM_USER.Id

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error(utils.T("api.import.import_user.saving.error"), result.Err)
		return nil
	} else {
		ruser := result.Data.(*model.User)

		if cresult := <-Srv.Store.User().VerifyEmail(ruser.Id); cresult.Err != nil {
			l4g.Error(utils.T("api.import.import_user.set_email.error"), cresult.Err)
		}

		if err := JoinUserToTeam(team, user, ""); err != nil {
			l4g.Error(utils.T("api.import.import_user.join_team.error"), err)
		}

		return ruser
	}
}

func OldImportChannel(channel *model.Channel) *model.Channel {
	if result := <-Srv.Store.Channel().Save(channel); result.Err != nil {
		return nil
	} else {
		sc := result.Data.(*model.Channel)

		return sc
	}
}

func OldImportFile(file io.Reader, teamId string, channelId string, userId string, fileName string) (*model.FileInfo, error) {
	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)
	data := buf.Bytes()

	fileInfo, err := DoUploadFile(teamId, channelId, userId, fileName, data)
	if err != nil {
		return nil, err
	}

	img, width, height := prepareImage(data)
	if img != nil {
		generateThumbnailImage(*img, fileInfo.ThumbnailPath, width, height)
		generatePreviewImage(*img, fileInfo.PreviewPath, width)
	}

	return fileInfo, nil
}

func OldImportIncomingWebhookPost(post *model.Post, props model.StringInterface) {
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	post.Message = linkWithTextRegex.ReplaceAllString(post.Message, "[${2}](${1})")

	post.AddProp("from_webhook", "true")

	if _, ok := props["override_username"]; !ok {
		post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if attachments, success := val.([]*model.SlackAttachment); success {
					parseSlackAttachment(post, attachments)
				}
			} else if key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	OldImportPost(post)
}
