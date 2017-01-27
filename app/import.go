// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
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
			if err := ImportLine(line, dryRun); err != nil {
				return err, lineNumber
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return model.NewLocAppError("BulkImport", "app.import.bulk_import.file_scan.error", nil, err.Error()), 0
	}

	return nil, 0
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
	if result := <-Srv.Store.Channel().GetByNameIncludeDeleted(team.Id, *data.Name); result.Err == nil {
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

//
// -- Old SlackImport Functions --
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func ImportPost(post *model.Post) {
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

func ImportUser(team *model.Team, user *model.User) *model.User {
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

		if err := JoinUserToTeam(team, user); err != nil {
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

func ImportFile(file io.Reader, teamId string, channelId string, userId string, fileName string) (*model.FileInfo, error) {
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

func ImportIncomingWebhookPost(post *model.Post, props model.StringInterface) {
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	post.Message = linkWithTextRegex.ReplaceAllString(post.Message, "[${2}](${1})")

	post.AddProp("from_webhook", "true")

	if _, ok := props["override_username"]; !ok {
		post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if list, success := val.([]interface{}); success {
					// parse attachment links into Markdown format
					for i, aInt := range list {
						attachment := aInt.(map[string]interface{})
						if aText, ok := attachment["text"].(string); ok {
							aText = linkWithTextRegex.ReplaceAllString(aText, "[${2}](${1})")
							attachment["text"] = aText
							list[i] = attachment
						}
						if aText, ok := attachment["pretext"].(string); ok {
							aText = linkWithTextRegex.ReplaceAllString(aText, "[${2}](${1})")
							attachment["pretext"] = aText
							list[i] = attachment
						}
						if fVal, ok := attachment["fields"]; ok {
							if fields, ok := fVal.([]interface{}); ok {
								// parse attachment field links into Markdown format
								for j, fInt := range fields {
									field := fInt.(map[string]interface{})
									if fValue, ok := field["value"].(string); ok {
										fValue = linkWithTextRegex.ReplaceAllString(fValue, "[${2}](${1})")
										field["value"] = fValue
										fields[j] = field
									}
								}
								attachment["fields"] = fields
								list[i] = attachment
							}
						}
					}
					post.AddProp(key, list)
				}
			} else if key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	ImportPost(post)
}
