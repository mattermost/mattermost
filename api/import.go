// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"
	"regexp"
	"unicode/utf8"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

//
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func ImportPost(post *model.Post) {
	for messageRuneCount := utf8.RuneCountInString(post.Message); messageRuneCount > 0; messageRuneCount = utf8.RuneCountInString(post.Message) {
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

		post.Id = ""
		post.CreateAt++
		post.Message = remainder
	}
}

func ImportUser(team *model.Team, user *model.User) *model.User {
	user.MakeNonNil()

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

func ImportChannel(channel *model.Channel) *model.Channel {
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

	fileInfo, err := doUploadFile(teamId, channelId, userId, fileName, data)
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
