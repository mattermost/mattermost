// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

const (
	TRIGGERWORDS_EXACT_MATCH = 0
	TRIGGERWORDS_STARTS_WITH = 1
)

func handleWebhookEvents(post *model.Post, team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil
	}

	if channel.Type != model.CHANNEL_OPEN {
		return nil
	}

	hchan := Srv.Store.Webhook().GetOutgoingByTeam(team.Id, -1, -1)
	result := <-hchan
	if result.Err != nil {
		return result.Err
	}

	hooks := result.Data.([]*model.OutgoingWebhook)
	if len(hooks) == 0 {
		return nil
	}

	var firstWord, triggerWord string

	splitWords := strings.Fields(post.Message)
	if len(splitWords) > 0 {
		firstWord = splitWords[0]
	}

	relevantHooks := []*model.OutgoingWebhook{}
	for _, hook := range hooks {
		if hook.ChannelId == post.ChannelId || len(hook.ChannelId) == 0 {
			if hook.ChannelId == post.ChannelId && len(hook.TriggerWords) == 0 {
				relevantHooks = append(relevantHooks, hook)
				triggerWord = ""
			} else if hook.TriggerWhen == TRIGGERWORDS_EXACT_MATCH && hook.TriggerWordExactMatch(firstWord) {
				relevantHooks = append(relevantHooks, hook)
				triggerWord = hook.GetTriggerWord(firstWord, true)
			} else if hook.TriggerWhen == TRIGGERWORDS_STARTS_WITH && hook.TriggerWordStartsWith(firstWord) {
				relevantHooks = append(relevantHooks, hook)
				triggerWord = hook.GetTriggerWord(firstWord, false)
			}
		}
	}

	for _, hook := range relevantHooks {
		payload := &model.OutgoingWebhookPayload{
			Token:       hook.Token,
			TeamId:      hook.TeamId,
			TeamDomain:  team.Name,
			ChannelId:   post.ChannelId,
			ChannelName: channel.Name,
			Timestamp:   post.CreateAt,
			UserId:      post.UserId,
			UserName:    user.Username,
			PostId:      post.Id,
			Text:        post.Message,
			TriggerWord: triggerWord,
			FileIds:     strings.Join(post.FileIds, ","),
		}
		go TriggerWebhook(payload, hook, post, channel)
	}

	return nil
}

func TriggerWebhook(payload *model.OutgoingWebhookPayload, hook *model.OutgoingWebhook, post *model.Post, channel *model.Channel) {
	var body io.Reader
	var contentType string
	if hook.ContentType == "application/json" {
		body = strings.NewReader(payload.ToJSON())
		contentType = "application/json"
	} else {
		body = strings.NewReader(payload.ToFormValues())
		contentType = "application/x-www-form-urlencoded"
	}

	for _, url := range hook.CallbackURLs {
		go func(url string) {
			req, _ := http.NewRequest("POST", url, body)
			req.Header.Set("Content-Type", contentType)
			req.Header.Set("Accept", "application/json")
			if resp, err := utils.HttpClient(false).Do(req); err != nil {
				l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.event_post.error"), err.Error())
			} else {
				defer CloseBody(resp)
				respProps := model.MapFromJson(resp.Body)

				if text, ok := respProps["text"]; ok {
					if _, err := CreateWebhookPost(hook.CreatorId, channel, text, respProps["username"], respProps["icon_url"], post.Props, post.Type); err != nil {
						l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.create_post.error"), err)
					}
				}
			}
		}(url)
	}
}

func CreateWebhookPost(userId string, channel *model.Channel, text, overrideUsername, overrideIconUrl string, props model.StringInterface, postType string) (*model.Post, *model.AppError) {
	// parse links into Markdown format
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	text = linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")

	post := &model.Post{UserId: userId, ChannelId: channel.Id, Message: text, Type: postType}
	post.AddProp("from_webhook", "true")

	if metrics := einterfaces.GetMetricsInterface(); metrics != nil {
		metrics.IncrementWebhookPost()
	}

	if utils.Cfg.ServiceSettings.EnablePostUsernameOverride {
		if len(overrideUsername) != 0 {
			post.AddProp("override_username", overrideUsername)
		} else {
			post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
		}
	}

	if utils.Cfg.ServiceSettings.EnablePostIconOverride {
		if len(overrideIconUrl) != 0 {
			post.AddProp("override_icon_url", overrideIconUrl)
		}
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if attachments, success := val.([]*model.SlackAttachment); success {
					parseSlackAttachment(post, attachments)
				}
			} else if key != "override_icon_url" && key != "override_username" && key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	splits := make([]string, 0)
	remainingText := post.Message

	for len(remainingText) > model.POST_MESSAGE_MAX_RUNES {
		splits = append(splits, remainingText[:model.POST_MESSAGE_MAX_RUNES])
		remainingText = remainingText[model.POST_MESSAGE_MAX_RUNES:]
	}

	splits = append(splits, remainingText)

	var firstPost *model.Post = nil

	for _, txt := range splits {
		post.Id = ""
		post.UpdateAt = 0
		post.CreateAt = 0
		post.Message = txt
		if _, err := CreatePostMissingChannel(post, false); err != nil {
			return nil, model.NewLocAppError("CreateWebhookPost", "api.post.create_webhook_post.creating.app_error", nil, "err="+err.Message)
		}

		if firstPost == nil {
			if len(splits) > 1 {
				firstPost = model.PostFromJson(strings.NewReader(post.ToJson()))
			} else {
				firstPost = post
			}
		}
	}

	return firstPost, nil
}

func CreateIncomingWebhookForChannel(creatorId string, channel *model.Channel, hook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("CreateIncomingWebhookForChannel", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hook.UserId = creatorId
	hook.TeamId = channel.TeamId

	if result := <-Srv.Store.Webhook().SaveIncoming(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func UpdateIncomingWebhook(oldHook, updatedHook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("UpdateIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	updatedHook.Id = oldHook.Id
	updatedHook.UserId = oldHook.UserId
	updatedHook.CreateAt = oldHook.CreateAt
	updatedHook.UpdateAt = model.GetMillis()
	updatedHook.TeamId = oldHook.TeamId
	updatedHook.DeleteAt = oldHook.DeleteAt

	if result := <-Srv.Store.Webhook().UpdateIncoming(updatedHook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func DeleteIncomingWebhook(hookId string) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return model.NewAppError("DeleteIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().DeleteIncoming(hookId, model.GetMillis()); result.Err != nil {
		return result.Err
	}

	InvalidateCacheForWebhook(hookId)

	return nil
}

func GetIncomingWebhook(hookId string) (*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetIncoming(hookId, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func GetIncomingWebhooksForTeamPage(teamId string, page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksForTeamPage", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetIncomingByTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.IncomingWebhook), nil
	}
}

func GetIncomingWebhooksPage(page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksPage", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetIncomingList(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.IncomingWebhook), nil
	}
}

func CreateOutgoingWebhook(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("CreateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(hook.ChannelId) != 0 {
		cchan := Srv.Store.Channel().Get(hook.ChannelId, true)

		var channel *model.Channel
		if result := <-cchan; result.Err != nil {
			return nil, result.Err
		} else {
			channel = result.Data.(*model.Channel)
		}

		if channel.Type != model.CHANNEL_OPEN {
			return nil, model.NewAppError("CreateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusForbidden)
		}

		if channel.Type != model.CHANNEL_OPEN || channel.TeamId != hook.TeamId {
			return nil, model.NewAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.permissions.app_error", nil, "", http.StatusForbidden)
		}
	} else if len(hook.TriggerWords) == 0 {
		return nil, model.NewAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.triggers.app_error", nil, "", http.StatusBadRequest)
	}

	if result := <-Srv.Store.Webhook().GetOutgoingByTeam(hook.TeamId, -1, -1); result.Err != nil {
		return nil, result.Err
	} else {
		allHooks := result.Data.([]*model.OutgoingWebhook)

		for _, existingOutHook := range allHooks {
			urlIntersect := utils.StringArrayIntersection(existingOutHook.CallbackURLs, hook.CallbackURLs)
			triggerIntersect := utils.StringArrayIntersection(existingOutHook.TriggerWords, hook.TriggerWords)

			if existingOutHook.ChannelId == hook.ChannelId && len(urlIntersect) != 0 && len(triggerIntersect) != 0 {
				return nil, model.NewLocAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.intersect.app_error", nil, "")
			}
		}
	}

	if result := <-Srv.Store.Webhook().SaveOutgoing(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func UpdateOutgoingWebhook(oldHook, updatedHook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("UpdateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(updatedHook.ChannelId) > 0 {
		channel, err := GetChannel(updatedHook.ChannelId)
		if err != nil {
			return nil, err
		}

		if channel.Type != model.CHANNEL_OPEN {
			return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.not_open.app_error", nil, "", http.StatusForbidden)
		}

		if channel.TeamId != oldHook.TeamId {
			return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.permissions.app_error", nil, "", http.StatusForbidden)
		}
	} else if len(updatedHook.TriggerWords) == 0 {
		return nil, model.NewLocAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.triggers.app_error", nil, "")
	}

	var result store.StoreResult
	if result = <-Srv.Store.Webhook().GetOutgoingByTeam(oldHook.TeamId, -1, -1); result.Err != nil {
		return nil, result.Err
	}

	allHooks := result.Data.([]*model.OutgoingWebhook)

	for _, existingOutHook := range allHooks {
		urlIntersect := utils.StringArrayIntersection(existingOutHook.CallbackURLs, updatedHook.CallbackURLs)
		triggerIntersect := utils.StringArrayIntersection(existingOutHook.TriggerWords, updatedHook.TriggerWords)

		if existingOutHook.ChannelId == updatedHook.ChannelId && len(urlIntersect) != 0 && len(triggerIntersect) != 0 && existingOutHook.Id != updatedHook.Id {
			return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.update_outgoing.intersect.app_error", nil, "", http.StatusBadRequest)
		}
	}

	updatedHook.CreatorId = oldHook.CreatorId
	updatedHook.CreateAt = oldHook.CreateAt
	updatedHook.DeleteAt = oldHook.DeleteAt
	updatedHook.TeamId = oldHook.TeamId
	updatedHook.UpdateAt = model.GetMillis()

	if result = <-Srv.Store.Webhook().UpdateOutgoing(updatedHook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func GetOutgoingWebhook(hookId string) (*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetOutgoing(hookId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func GetOutgoingWebhooksPage(page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetOutgoingList(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OutgoingWebhook), nil
	}
}

func GetOutgoingWebhooksForChannelPage(channelId string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksForChannelPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetOutgoingByChannel(channelId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OutgoingWebhook), nil
	}
}

func GetOutgoingWebhooksForTeamPage(teamId string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksForTeamPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetOutgoingByTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OutgoingWebhook), nil
	}
}

func DeleteOutgoingWebhook(hookId string) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return model.NewAppError("DeleteOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().DeleteOutgoing(hookId, model.GetMillis()); result.Err != nil {
		return result.Err
	}

	return nil
}

func RegenOutgoingWebhookToken(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("RegenOutgoingWebhookToken", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hook.Token = model.NewId()

	if result := <-Srv.Store.Webhook().UpdateOutgoing(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func HandleIncomingWebhook(hookId string, req *model.IncomingWebhookRequest) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hchan := Srv.Store.Webhook().GetIncoming(hookId, true)

	if req == nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.parse.app_error", nil, "", http.StatusBadRequest)
	}

	text := req.Text
	if len(text) == 0 && req.Attachments == nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.text.app_error", nil, "", http.StatusBadRequest)
	}

	channelName := req.ChannelName
	webhookType := req.Type

	// attachments is in here for slack compatibility
	if len(req.Attachments) > 0 {
		if len(req.Props) == 0 {
			req.Props = make(model.StringInterface)
		}
		req.Props["attachments"] = req.Attachments

		attachmentSize := utf8.RuneCountInString(model.StringInterfaceToJson(req.Props))
		// Minus 100 to leave room for setting post type in the Props
		if attachmentSize > model.POST_PROPS_MAX_RUNES-100 {
			return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.attachment.app_error", map[string]interface{}{"Max": model.POST_PROPS_MAX_RUNES - 100, "Actual": attachmentSize}, "", http.StatusBadRequest)
		}

		webhookType = model.POST_SLACK_ATTACHMENT
	}

	var hook *model.IncomingWebhook
	if result := <-hchan; result.Err != nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.invalid.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
	} else {
		hook = result.Data.(*model.IncomingWebhook)
	}

	var channel *model.Channel
	var cchan store.StoreChannel

	if len(channelName) != 0 {
		if channelName[0] == '@' {
			if result := <-Srv.Store.User().GetByUsername(channelName[1:]); result.Err != nil {
				return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.user.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
			} else {
				if ch, err := GetDirectChannel(hook.UserId, result.Data.(*model.User).Id); err != nil {
					return err
				} else {
					channel = ch
				}
			}
		} else if channelName[0] == '#' {
			cchan = Srv.Store.Channel().GetByName(hook.TeamId, channelName[1:], true)
		} else {
			cchan = Srv.Store.Channel().GetByName(hook.TeamId, channelName, true)
		}
	} else {
		cchan = Srv.Store.Channel().Get(hook.ChannelId, true)
	}

	if channel == nil {
		result := <-cchan
		if result.Err != nil {
			return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
		} else {
			channel = result.Data.(*model.Channel)
		}
	}

	if channel.Type != model.CHANNEL_OPEN && !HasPermissionToChannel(hook.UserId, channel.Id, model.PERMISSION_READ_CHANNEL) {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.permissions.app_error", nil, "", http.StatusForbidden)
	}

	overrideUsername := req.Username
	overrideIconUrl := req.IconURL

	if _, err := CreateWebhookPost(hook.UserId, channel, text, overrideUsername, overrideIconUrl, req.Props, webhookType); err != nil {
		return err
	}

	return nil
}

func CreateCommandWebhook(commandId string, args *model.CommandArgs) (*model.CommandWebhook, *model.AppError) {
	hook := &model.CommandWebhook{
		CommandId: commandId,
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
		ParentId:  args.ParentId,
	}

	if result := <-Srv.Store.CommandWebhook().Save(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.CommandWebhook), nil
	}
}

func HandleCommandWebhook(hookId string, response *model.CommandResponse) *model.AppError {
	if response == nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.parse.app_error", nil, "", http.StatusBadRequest)
	}

	var hook *model.CommandWebhook
	if result := <-Srv.Store.CommandWebhook().Get(hookId); result.Err != nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.invalid.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
	} else {
		hook = result.Data.(*model.CommandWebhook)
	}

	var cmd *model.Command
	if result := <-Srv.Store.Command().Get(hook.CommandId); result.Err != nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.command.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
	} else {
		cmd = result.Data.(*model.Command)
	}

	args := &model.CommandArgs{
		UserId:    hook.UserId,
		ChannelId: hook.ChannelId,
		TeamId:    cmd.TeamId,
		RootId:    hook.RootId,
		ParentId:  hook.ParentId,
	}

	if result := <-Srv.Store.CommandWebhook().TryUse(hook.Id, 5); result.Err != nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.invalid.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
	}

	_, err := HandleCommandResponse(cmd, args, response, false)
	return err
}
