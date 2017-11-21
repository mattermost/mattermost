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
	"sync"
	"time"
	"unicode/utf8"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

// Import Data Models

type LineImportData struct {
	Type          string                   `json:"type"`
	Team          *TeamImportData          `json:"team"`
	Channel       *ChannelImportData       `json:"channel"`
	User          *UserImportData          `json:"user"`
	Post          *PostImportData          `json:"post"`
	DirectChannel *DirectChannelImportData `json:"direct_channel"`
	DirectPost    *DirectPostImportData    `json:"direct_post"`
	Version       *int                     `json:"version"`
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
	Password    *string `json:"password"`
	Nickname    *string `json:"nickname"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Position    *string `json:"position"`
	Roles       *string `json:"roles"`
	Locale      *string `json:"locale"`

	Teams *[]UserTeamImportData `json:"teams"`

	Theme              *string `json:"theme"`
	UseMilitaryTime    *string `json:"military_time"`
	CollapsePreviews   *string `json:"link_previews"`
	MessageDisplay     *string `json:"message_display"`
	ChannelDisplayMode *string `json:"channel_display_mode"`
	TutorialStep       *string `json:"tutorial_step"`

	NotifyProps *UserNotifyPropsImportData `json:"notify_props"`
}

type UserNotifyPropsImportData struct {
	Desktop         *string `json:"desktop"`
	DesktopDuration *string `json:"desktop_duration"`
	DesktopSound    *string `json:"desktop_sound"`

	Email *string `json:"email"`

	Mobile           *string `json:"mobile"`
	MobilePushStatus *string `json:"mobile_push_status"`

	ChannelTrigger  *string `json:"channel"`
	CommentsTrigger *string `json:"comments"`
	MentionKeys     *string `json:"mention_keys"`
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
	Favorite    *bool                             `json:"favorite"`
}

type UserChannelNotifyPropsImportData struct {
	Desktop    *string `json:"desktop"`
	Mobile     *string `json:"mobile"`
	MarkUnread *string `json:"mark_unread"`
}

type PostImportData struct {
	Team    *string `json:"team"`
	Channel *string `json:"channel"`
	User    *string `json:"user"`

	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`

	FlaggedBy *[]string `json:"flagged_by"`
}

type DirectChannelImportData struct {
	Members     *[]string `json:"members"`
	FavoritedBy *[]string `json:"favorited_by"`

	Header *string `json:"header"`
}

type DirectPostImportData struct {
	ChannelMembers *[]string `json:"channel_members"`
	User           *string   `json:"user"`

	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`

	FlaggedBy *[]string `json:"flagged_by"`
}

type LineImportWorkerData struct {
	LineImportData
	LineNumber int
}

type LineImportWorkerError struct {
	Error      *model.AppError
	LineNumber int
}

//
// -- Bulk Import Functions --
// These functions import data directly into the database. Security and permission checks are bypassed but validity is
// still enforced.
//

func (a *App) bulkImportWorker(dryRun bool, wg *sync.WaitGroup, lines <-chan LineImportWorkerData, errors chan<- LineImportWorkerError) {
	for line := range lines {
		if err := a.ImportLine(line.LineImportData, dryRun); err != nil {
			errors <- LineImportWorkerError{err, line.LineNumber}
		}
	}
	wg.Done()
}

func (a *App) BulkImport(fileReader io.Reader, dryRun bool, workers int) (*model.AppError, int) {
	scanner := bufio.NewScanner(fileReader)
	lineNumber := 0

	errorsChan := make(chan LineImportWorkerError, (2*workers)+1) // size chosen to ensure it never gets filled up completely.
	var wg sync.WaitGroup
	var linesChan chan LineImportWorkerData
	lastLineType := ""

	for scanner.Scan() {
		decoder := json.NewDecoder(strings.NewReader(scanner.Text()))
		lineNumber++

		var line LineImportData
		if err := decoder.Decode(&line); err != nil {
			return model.NewAppError("BulkImport", "app.import.bulk_import.json_decode.error", nil, err.Error(), http.StatusBadRequest), lineNumber
		} else {
			if lineNumber == 1 {
				importDataFileVersion, apperr := processImportDataFileVersionLine(line)
				if apperr != nil {
					return apperr, lineNumber
				}

				if importDataFileVersion != 1 {
					return model.NewAppError("BulkImport", "app.import.bulk_import.unsupported_version.error", nil, "", http.StatusBadRequest), lineNumber
				}
			} else {
				if line.Type != lastLineType {
					if lastLineType != "" {
						// Changing type. Clear out the worker queue before continuing.
						close(linesChan)
						wg.Wait()

						// Check no errors occurred while waiting for the queue to empty.
						if len(errorsChan) != 0 {
							err := <-errorsChan
							return err.Error, err.LineNumber
						}
					}

					// Set up the workers and channel for this type.
					lastLineType = line.Type
					linesChan = make(chan LineImportWorkerData, workers)
					for i := 0; i < workers; i++ {
						wg.Add(1)
						go a.bulkImportWorker(dryRun, &wg, linesChan, errorsChan)
					}
				}

				select {
				case linesChan <- LineImportWorkerData{line, lineNumber}:
				case err := <-errorsChan:
					close(linesChan)
					wg.Wait()
					return err.Error, err.LineNumber
				}
			}
		}
	}

	// No more lines. Clear out the worker queue before continuing.
	close(linesChan)
	wg.Wait()

	// Check no errors occurred while waiting for the queue to empty.
	if len(errorsChan) != 0 {
		err := <-errorsChan
		return err.Error, err.LineNumber
	}

	if err := scanner.Err(); err != nil {
		return model.NewAppError("BulkImport", "app.import.bulk_import.file_scan.error", nil, err.Error(), http.StatusInternalServerError), 0
	}

	return nil, 0
}

func processImportDataFileVersionLine(line LineImportData) (int, *model.AppError) {
	if line.Type != "version" || line.Version == nil {
		return -1, model.NewAppError("BulkImport", "app.import.process_import_data_file_version_line.invalid_version.error", nil, "", http.StatusBadRequest)
	}

	return *line.Version, nil
}

func (a *App) ImportLine(line LineImportData, dryRun bool) *model.AppError {
	switch {
	case line.Type == "team":
		if line.Team == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_team.error", nil, "", http.StatusBadRequest)
		} else {
			return a.ImportTeam(line.Team, dryRun)
		}
	case line.Type == "channel":
		if line.Channel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_channel.error", nil, "", http.StatusBadRequest)
		} else {
			return a.ImportChannel(line.Channel, dryRun)
		}
	case line.Type == "user":
		if line.User == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_user.error", nil, "", http.StatusBadRequest)
		} else {
			return a.ImportUser(line.User, dryRun)
		}
	case line.Type == "post":
		if line.Post == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_post.error", nil, "", http.StatusBadRequest)
		} else {
			return a.ImportPost(line.Post, dryRun)
		}
	case line.Type == "direct_channel":
		if line.DirectChannel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_direct_channel.error", nil, "", http.StatusBadRequest)
		} else {
			return a.ImportDirectChannel(line.DirectChannel, dryRun)
		}
	case line.Type == "direct_post":
		if line.DirectPost == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_direct_post.error", nil, "", http.StatusBadRequest)
		} else {
			return a.ImportDirectPost(line.DirectPost, dryRun)
		}
	default:
		return model.NewAppError("BulkImport", "app.import.import_line.unknown_line_type.error", map[string]interface{}{"Type": line.Type}, "", http.StatusBadRequest)
	}
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

	if team.Id == "" {
		if _, err := a.CreateTeam(team); err != nil {
			return err
		}
	} else {
		if _, err := a.UpdateTeam(team); err != nil {
			return err
		}
	}

	return nil
}

func validateTeamImportData(data *TeamImportData) *model.AppError {

	if data.Name == nil {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_missing.error", nil, "", http.StatusBadRequest)
	} else if len(*data.Name) > model.TEAM_NAME_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_length.error", nil, "", http.StatusBadRequest)
	} else if model.IsReservedTeamName(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_reserved.error", nil, "", http.StatusBadRequest)
	} else if !model.IsValidTeamName(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_characters.error", nil, "", http.StatusBadRequest)
	}

	if data.DisplayName == nil {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.display_name_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.DisplayName) == 0 || utf8.RuneCountInString(*data.DisplayName) > model.TEAM_DISPLAY_NAME_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.display_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Type == nil {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.type_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.Type != model.TEAM_OPEN && *data.Type != model.TEAM_INVITE {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.type_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Description != nil && len(*data.Description) > model.TEAM_DESCRIPTION_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.description_length.error", nil, "", http.StatusBadRequest)
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

	var team *model.Team
	if result := <-a.Srv.Store.Team().GetByName(*data.Team); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_channel.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, "", http.StatusBadRequest)
	} else {
		team = result.Data.(*model.Team)
	}

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

func validateChannelImportData(data *ChannelImportData) *model.AppError {

	if data.Team == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.team_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Name == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.name_missing.error", nil, "", http.StatusBadRequest)
	} else if len(*data.Name) > model.CHANNEL_NAME_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.name_length.error", nil, "", http.StatusBadRequest)
	} else if !model.IsValidChannelIdentifier(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.name_characters.error", nil, "", http.StatusBadRequest)
	}

	if data.DisplayName == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.display_name_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.DisplayName) == 0 || utf8.RuneCountInString(*data.DisplayName) > model.CHANNEL_DISPLAY_NAME_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.display_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Type == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.type_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.Type != model.CHANNEL_OPEN && *data.Type != model.CHANNEL_PRIVATE {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.type_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Header != nil && utf8.RuneCountInString(*data.Header) > model.CHANNEL_HEADER_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.header_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Purpose != nil && utf8.RuneCountInString(*data.Purpose) > model.CHANNEL_PURPOSE_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.purpose_length.error", nil, "", http.StatusBadRequest)
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

		if data.NotifyProps.DesktopDuration != nil {
			if value, ok := user.NotifyProps[model.DESKTOP_DURATION_NOTIFY_PROP]; !ok || value != *data.NotifyProps.DesktopDuration {
				user.AddNotifyProp(model.DESKTOP_DURATION_NOTIFY_PROP, *data.NotifyProps.DesktopDuration)
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
			Name:     "use_military_time",
			Value:    *data.UseMilitaryTime,
		})
	}

	if data.CollapsePreviews != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "collapse_previews",
			Value:    *data.CollapsePreviews,
		})
	}

	if data.MessageDisplay != nil {
		preferences = append(preferences, model.Preference{
			UserId:   savedUser.Id,
			Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
			Name:     "message_display",
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

	if len(preferences) > 0 {
		if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
			return model.NewAppError("BulkImport", "app.import.import_user.save_preferences.error", nil, "", http.StatusInternalServerError)
		}
	}

	return a.ImportUserTeams(savedUser, data.Teams)
}

func (a *App) ImportUserTeams(user *model.User, data *[]UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	for _, tdata := range *data {
		team, err := a.GetTeamByName(*tdata.Name)
		if err != nil {
			return err
		}

		var roles string
		if tdata.Roles == nil {
			roles = model.TEAM_USER_ROLE_ID
		} else {
			roles = *tdata.Roles
		}

		var member *model.TeamMember
		if member, _, err = a.joinUserToTeam(team, user); err != nil {
			return err
		}

		if member.Roles != roles {
			if _, err := a.UpdateTeamMemberRoles(team.Id, user.Id, roles); err != nil {
				return err
			}
		}

		if err := a.ImportUserChannels(user, team, member, tdata.Channels); err != nil {
			return err
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
		channel, err := a.GetChannelByName(*cdata.Name, team.Id)
		if err != nil {
			return err
		}

		var roles string
		if cdata.Roles == nil {
			roles = model.CHANNEL_USER_ROLE_ID
		} else {
			roles = *cdata.Roles
		}

		var member *model.ChannelMember
		member, err = a.GetChannelMember(channel.Id, user.Id)
		if err != nil {
			member, err = a.addUserToChannel(user, channel, teamMember)
			if err != nil {
				return err
			}
		}

		if member.Roles != roles {
			if _, err := a.UpdateChannelMemberRoles(channel.Id, user.Id, roles); err != nil {
				return err
			}
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
			return model.NewAppError("BulkImport", "app.import.import_user_channels.save_preferences.error", nil, "", http.StatusInternalServerError)
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

	if data.AuthData != nil && data.Password != nil {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_data_and_password.error", nil, "", http.StatusBadRequest)
	}

	if data.AuthData != nil && len(*data.AuthData) > model.USER_AUTH_DATA_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_data_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Password != nil && len(*data.Password) == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.pasword_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Password != nil && len(*data.Password) > model.USER_PASSWORD_MAX_LENGTH {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.password_length.error", nil, "", http.StatusBadRequest)
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

	if data.NotifyProps != nil {
		if data.NotifyProps.Desktop != nil && !model.IsValidUserNotifyLevel(*data.NotifyProps.Desktop) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_desktop_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.DesktopDuration != nil && !model.IsValidNumberString(*data.NotifyProps.DesktopDuration) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_desktop_duration_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.DesktopSound != nil && !model.IsValidTrueOrFalseString(*data.NotifyProps.DesktopSound) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_desktop_sound_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.Email != nil && !model.IsValidTrueOrFalseString(*data.NotifyProps.Email) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_email_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.Mobile != nil && !model.IsValidUserNotifyLevel(*data.NotifyProps.Mobile) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_mobile_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.MobilePushStatus != nil && !model.IsValidPushStatusNotifyLevel(*data.NotifyProps.MobilePushStatus) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_mobile_push_status_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.ChannelTrigger != nil && !model.IsValidTrueOrFalseString(*data.NotifyProps.ChannelTrigger) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_channel_trigger_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.CommentsTrigger != nil && !model.IsValidCommentsNotifyLevel(*data.NotifyProps.CommentsTrigger) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_comments_trigger_invalid.error", nil, "", http.StatusBadRequest)
		}
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

			if cdata.NotifyProps.Mobile != nil && !model.IsChannelNotifyLevelValid(*cdata.NotifyProps.Mobile) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_mobile.error", nil, "", http.StatusBadRequest)
			}

			if cdata.NotifyProps.MarkUnread != nil && !model.IsChannelMarkUnreadLevelValid(*cdata.NotifyProps.MarkUnread) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_mark_unread.error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (a *App) ImportPost(data *PostImportData, dryRun bool) *model.AppError {
	if err := validatePostImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var team *model.Team
	if result := <-a.Srv.Store.Team().GetByName(*data.Team); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.team_not_found.error", map[string]interface{}{"TeamName": *data.Team}, "", http.StatusBadRequest)
	} else {
		team = result.Data.(*model.Team)
	}

	var channel *model.Channel
	if result := <-a.Srv.Store.Channel().GetByName(team.Id, *data.Channel, false); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.channel_not_found.error", map[string]interface{}{"ChannelName": *data.Channel}, "", http.StatusBadRequest)
	} else {
		channel = result.Data.(*model.Channel)
	}

	var user *model.User
	if result := <-a.Srv.Store.User().GetByUsername(*data.User); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, "", http.StatusBadRequest)
	} else {
		user = result.Data.(*model.User)
	}

	// Check if this post already exists.
	var posts []*model.Post
	if result := <-a.Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt); result.Err != nil {
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
			var user *model.User

			if result := <-a.Srv.Store.User().GetByUsername(username); result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_post.user_not_found.error", map[string]interface{}{"Username": username}, "", http.StatusBadRequest)
			} else {
				user = result.Data.(*model.User)
			}

			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
				Name:     post.Id,
				Value:    "true",
			})
		}

		if len(preferences) > 0 {
			if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_post.save_preferences.error", nil, "", http.StatusInternalServerError)
			}
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
		if result := <-a.Srv.Store.User().GetByUsername(username); result.Err == nil {
			user := result.Data.(*model.User)
			userIds = append(userIds, user.Id)
			userMap[username] = user.Id
		} else {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.member_not_found.error", nil, "", http.StatusBadRequest)
		}
	}

	var channel *model.Channel

	if len(userIds) == 2 {
		ch, err := a.createDirectChannel(userIds[0], userIds[1])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_direct_channel.error", nil, "", http.StatusBadRequest)
		} else {
			channel = ch
		}
	} else {
		ch, err := a.createGroupChannel(userIds, userIds[0])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.create_group_channel.error", nil, "", http.StatusBadRequest)
		} else {
			channel = ch
		}
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
			return model.NewAppError("BulkImport", "app.import.import_direct_channel.update_header_failed.error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func validateDirectChannelImportData(data *DirectChannelImportData) *model.AppError {
	if data.Members == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.members_required.error", nil, "", http.StatusBadRequest)
	}

	if len(*data.Members) != 2 {
		if len(*data.Members) < model.CHANNEL_GROUP_MIN_USERS {
			return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.members_too_few.error", nil, "", http.StatusBadRequest)
		} else if len(*data.Members) > model.CHANNEL_GROUP_MAX_USERS {
			return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.members_too_many.error", nil, "", http.StatusBadRequest)
		}
	}

	if data.Header != nil && utf8.RuneCountInString(*data.Header) > model.CHANNEL_HEADER_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.header_length.error", nil, "", http.StatusBadRequest)
	}

	if data.FavoritedBy != nil {
		for _, favoriter := range *data.FavoritedBy {
			found := false
			for _, member := range *data.Members {
				if favoriter == member {
					found = true
					break
				}
			}
			if !found {
				return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.unknown_favoriter.error", map[string]interface{}{"Username": favoriter}, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (a *App) ImportDirectPost(data *DirectPostImportData, dryRun bool) *model.AppError {
	if err := validateDirectPostImportData(data); err != nil {
		return err
	}

	// If this is a Dry Run, do not continue any further.
	if dryRun {
		return nil
	}

	var userIds []string
	for _, username := range *data.ChannelMembers {
		if result := <-a.Srv.Store.User().GetByUsername(username); result.Err == nil {
			user := result.Data.(*model.User)
			userIds = append(userIds, user.Id)
		} else {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.channel_member_not_found.error", nil, "", http.StatusBadRequest)
		}
	}

	var channel *model.Channel
	if len(userIds) == 2 {
		ch, err := a.createDirectChannel(userIds[0], userIds[1])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.create_direct_channel.error", nil, "", http.StatusBadRequest)
		} else {
			channel = ch
		}
	} else {
		ch, err := a.createGroupChannel(userIds, userIds[0])
		if err != nil && err.Id != store.CHANNEL_EXISTS_ERROR {
			return model.NewAppError("BulkImport", "app.import.import_direct_post.create_group_channel.error", nil, "", http.StatusBadRequest)
		} else {
			channel = ch
		}
	}

	var user *model.User
	if result := <-a.Srv.Store.User().GetByUsername(*data.User); result.Err != nil {
		return model.NewAppError("BulkImport", "app.import.import_direct_post.user_not_found.error", map[string]interface{}{"Username": *data.User}, "", http.StatusBadRequest)
	} else {
		user = result.Data.(*model.User)
	}

	// Check if this post already exists.
	var posts []*model.Post
	if result := <-a.Srv.Store.Post().GetPostsCreatedAt(channel.Id, *data.CreateAt); result.Err != nil {
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
			var user *model.User

			if result := <-a.Srv.Store.User().GetByUsername(username); result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_direct_post.user_not_found.error", map[string]interface{}{"Username": username}, "", http.StatusBadRequest)
			} else {
				user = result.Data.(*model.User)
			}

			preferences = append(preferences, model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
				Name:     post.Id,
				Value:    "true",
			})
		}

		if len(preferences) > 0 {
			if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
				return model.NewAppError("BulkImport", "app.import.import_direct_post.save_preferences.error", nil, "", http.StatusInternalServerError)
			}
		}
	}

	return nil
}

func validateDirectPostImportData(data *DirectPostImportData) *model.AppError {
	if data.ChannelMembers == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.channel_members_required.error", nil, "", http.StatusBadRequest)
	}

	if len(*data.ChannelMembers) != 2 {
		if len(*data.ChannelMembers) < model.CHANNEL_GROUP_MIN_USERS {
			return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.channel_members_too_few.error", nil, "", http.StatusBadRequest)
		} else if len(*data.ChannelMembers) > model.CHANNEL_GROUP_MAX_USERS {
			return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.channel_members_too_many.error", nil, "", http.StatusBadRequest)
		}
	}

	if data.User == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.user_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Message == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.message_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.Message) > model.POST_MESSAGE_MAX_RUNES {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.message_length.error", nil, "", http.StatusBadRequest)
	}

	if data.CreateAt == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.create_at_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.create_at_zero.error", nil, "", http.StatusBadRequest)
	}

	if data.FlaggedBy != nil {
		for _, flagger := range *data.FlaggedBy {
			found := false
			for _, member := range *data.ChannelMembers {
				if flagger == member {
					found = true
					break
				}
			}
			if !found {
				return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.unknown_flagger.error", map[string]interface{}{"Username": flagger}, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

//
// -- Old SlackImport Functions --
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func (a *App) OldImportPost(post *model.Post) {
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

		if result := <-a.Srv.Store.Post().Save(post); result.Err != nil {
			l4g.Debug(utils.T("api.import.import_post.saving.debug"), post.UserId, post.Message)
		}

		for _, fileId := range post.FileIds {
			if result := <-a.Srv.Store.FileInfo().AttachToPost(fileId, post.Id); result.Err != nil {
				l4g.Error(utils.T("api.import.import_post.attach_files.error"), post.Id, post.FileIds, result.Err)
			}
		}

		post.Id = ""
		post.CreateAt++
		post.Message = remainder
	}
}

func (a *App) OldImportUser(team *model.Team, user *model.User) *model.User {
	user.MakeNonNil()

	user.Roles = model.SYSTEM_USER_ROLE_ID

	if result := <-a.Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error(utils.T("api.import.import_user.saving.error"), result.Err)
		return nil
	} else {
		ruser := result.Data.(*model.User)

		if cresult := <-a.Srv.Store.User().VerifyEmail(ruser.Id); cresult.Err != nil {
			l4g.Error(utils.T("api.import.import_user.set_email.error"), cresult.Err)
		}

		if err := a.JoinUserToTeam(team, user, ""); err != nil {
			l4g.Error(utils.T("api.import.import_user.join_team.error"), err)
		}

		return ruser
	}
}

func (a *App) OldImportChannel(channel *model.Channel) *model.Channel {
	if result := <-a.Srv.Store.Channel().Save(channel, *a.Config().TeamSettings.MaxChannelsPerTeam); result.Err != nil {
		return nil
	} else {
		sc := result.Data.(*model.Channel)

		return sc
	}
}

func (a *App) OldImportFile(timestamp time.Time, file io.Reader, teamId string, channelId string, userId string, fileName string) (*model.FileInfo, error) {
	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)
	data := buf.Bytes()

	fileInfo, err := a.DoUploadFile(timestamp, teamId, channelId, userId, fileName, data)
	if err != nil {
		return nil, err
	}

	img, width, height := prepareImage(data)
	if img != nil {
		a.generateThumbnailImage(*img, fileInfo.ThumbnailPath, width, height)
		a.generatePreviewImage(*img, fileInfo.PreviewPath, width)
	}

	return fileInfo, nil
}

func (a *App) OldImportIncomingWebhookPost(post *model.Post, props model.StringInterface) {
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

	a.OldImportPost(post)
}
