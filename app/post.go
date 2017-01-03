// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"regexp"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func CreatePost(post *model.Post, teamId string, triggerWebhooks bool) (*model.Post, *model.AppError) {
	var pchan store.StoreChannel
	if len(post.RootId) > 0 {
		pchan = Srv.Store.Post().Get(post.RootId)
	}

	// Verify the parent/child relationships are correct
	if pchan != nil {
		if presult := <-pchan; presult.Err != nil {
			return nil, model.NewLocAppError("createPost", "api.post.create_post.root_id.app_error", nil, "")
		} else {
			list := presult.Data.(*model.PostList)
			if len(list.Posts) == 0 || !list.IsChannelId(post.ChannelId) {
				return nil, model.NewLocAppError("createPost", "api.post.create_post.channel_root_id.app_error", nil, "")
			}

			if post.ParentId == "" {
				post.ParentId = post.RootId
			}

			if post.RootId != post.ParentId {
				parent := list.Posts[post.ParentId]
				if parent == nil {
					return nil, model.NewLocAppError("createPost", "api.post.create_post.parent_id.app_error", nil, "")
				}
			}
		}
	}

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	var rpost *model.Post
	if result := <-Srv.Store.Post().Save(post); result.Err != nil {
		return nil, result.Err
	} else {
		rpost = result.Data.(*model.Post)
	}

	if einterfaces.GetMetricsInterface() != nil {
		einterfaces.GetMetricsInterface().IncrementPostCreate()
	}

	if len(post.FileIds) > 0 {
		// There's a rare bug where the client sends up duplicate FileIds so protect against that
		post.FileIds = utils.RemoveDuplicatesFromStringArray(post.FileIds)

		for _, fileId := range post.FileIds {
			if result := <-Srv.Store.FileInfo().AttachToPost(fileId, post.Id); result.Err != nil {
				l4g.Error(utils.T("api.post.create_post.attach_files.error"), post.Id, post.FileIds, post.UserId, result.Err)
			}
		}

		if einterfaces.GetMetricsInterface() != nil {
			einterfaces.GetMetricsInterface().IncrementPostFileAttachment(len(post.FileIds))
		}
	}

	InvalidateCacheForChannel(rpost.ChannelId)
	InvalidateCacheForChannelPosts(rpost.ChannelId)

	if err := handlePostEvents(rpost, teamId, triggerWebhooks); err != nil {
		return nil, err
	}

	return rpost, nil
}

func handlePostEvents(post *model.Post, teamId string, triggerWebhooks bool) *model.AppError {
	tchan := Srv.Store.Team().Get(teamId)
	cchan := Srv.Store.Channel().Get(post.ChannelId, true)
	uchan := Srv.Store.User().Get(post.UserId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		return result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		return result.Err
	} else {
		channel = result.Data.(*model.Channel)
	}

	if _, err := SendNotifications(post, team, channel); err != nil {
		return err
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if triggerWebhooks {
		go func() {
			if err := handleWebhookEvents(post, team, channel, user); err != nil {
				l4g.Error(err.Error())
			}
		}()
	}

	if channel.Type == model.CHANNEL_DIRECT {
		go func() {
			if err := MakeDirectChannelVisible(post.ChannelId); err != nil {
				l4g.Error(err.Error())
			}
		}()
	}

	return nil
}

var linkWithTextRegex *regexp.Regexp = regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)

// This method only parses and processes the attachments,
// all else should be set in the post which is passed
func parseSlackAttachment(post *model.Post, attachments interface{}) {
	post.Type = model.POST_SLACK_ATTACHMENT

	if list, success := attachments.([]interface{}); success {
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
		post.AddProp("attachments", list)
	}
}

func parseSlackLinksToMarkdown(text string) string {
	return linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")
}

func SendEphemeralPost(teamId, userId string, post *model.Post) *model.Post {
	post.Type = model.POST_EPHEMERAL

	// fill in fields which haven't been specified which have sensible defaults
	if post.Id == "" {
		post.Id = model.NewId()
	}
	if post.CreateAt == 0 {
		post.CreateAt = model.GetMillis()
	}
	if post.Props == nil {
		post.Props = model.StringInterface{}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_EPHEMERAL_MESSAGE, "", post.ChannelId, userId, nil)
	message.Add("post", post.ToJson())

	go Publish(message)

	return post
}
