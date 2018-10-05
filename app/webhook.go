// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	TRIGGERWORDS_EXACT_MATCH = 0
	TRIGGERWORDS_STARTS_WITH = 1
)

func (a *App) handleWebhookEvents(post *model.Post, team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil
	}

	if channel.Type != model.CHANNEL_OPEN {
		return nil
	}

	hchan := a.Srv.Store.Webhook().GetOutgoingByTeam(team.Id, -1, -1)
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
		a.Go(func(hook *model.OutgoingWebhook) func() {
			return func() {
				a.TriggerWebhook(payload, hook, post, channel)
			}
		}(hook))
	}

	return nil
}

func (a *App) TriggerWebhook(payload *model.OutgoingWebhookPayload, hook *model.OutgoingWebhook, post *model.Post, channel *model.Channel) {
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
		a.Go(func(url string) func() {
			return func() {
				req, _ := http.NewRequest("POST", url, body)
				req.Header.Set("Content-Type", contentType)
				req.Header.Set("Accept", "application/json")
				if resp, err := a.HTTPService.MakeClient(false).Do(req); err != nil {
					mlog.Error(fmt.Sprintf("Event POST failed, err=%s", err.Error()))
				} else {
					defer consumeAndClose(resp)

					webhookResp := model.OutgoingWebhookResponseFromJson(resp.Body)

					if webhookResp != nil && (webhookResp.Text != nil || len(webhookResp.Attachments) > 0) {
						postRootId := ""
						if webhookResp.ResponseType == model.OUTGOING_HOOK_RESPONSE_TYPE_COMMENT {
							postRootId = post.Id
						}
						if len(webhookResp.Props) == 0 {
							webhookResp.Props = make(model.StringInterface)
						}
						webhookResp.Props["webhook_display_name"] = hook.DisplayName

						text := ""
						if webhookResp.Text != nil {
							text = a.ProcessSlackText(*webhookResp.Text)
						}
						webhookResp.Attachments = a.ProcessSlackAttachments(webhookResp.Attachments)
						// attachments is in here for slack compatibility
						if len(webhookResp.Attachments) > 0 {
							webhookResp.Props["attachments"] = webhookResp.Attachments
						}
						if a.Config().ServiceSettings.EnablePostUsernameOverride && hook.Username != "" && webhookResp.Username == "" {
							webhookResp.Username = hook.Username
						}

						if a.Config().ServiceSettings.EnablePostIconOverride && hook.IconURL != "" && webhookResp.IconURL == "" {
							webhookResp.IconURL = hook.IconURL
						}
						if _, err := a.CreateWebhookPost(hook.CreatorId, channel, text, webhookResp.Username, webhookResp.IconURL, webhookResp.Props, webhookResp.Type, postRootId); err != nil {
							mlog.Error(fmt.Sprintf("Failed to create response post, err=%v", err))
						}
					}
				}
			}
		}(url))
	}
}

func SplitWebhookPost(post *model.Post, maxPostSize int) ([]*model.Post, *model.AppError) {
	splits := make([]*model.Post, 0)
	remainingText := post.Message

	base := *post
	base.Message = ""
	base.Props = make(map[string]interface{})
	for k, v := range post.Props {
		if k != "attachments" {
			base.Props[k] = v
		}
	}
	if utf8.RuneCountInString(model.StringInterfaceToJson(base.Props)) > model.POST_PROPS_MAX_USER_RUNES {
		return nil, model.NewAppError("SplitWebhookPost", "web.incoming_webhook.split_props_length.app_error", map[string]interface{}{"Max": model.POST_PROPS_MAX_USER_RUNES}, "", http.StatusBadRequest)
	}

	for utf8.RuneCountInString(remainingText) > maxPostSize {
		split := base
		x := 0
		for index := range remainingText {
			x++
			if x > maxPostSize {
				split.Message = remainingText[:index]
				remainingText = remainingText[index:]
				break
			}
		}
		splits = append(splits, &split)
	}

	split := base
	split.Message = remainingText
	splits = append(splits, &split)

	attachments, _ := post.Props["attachments"].([]*model.SlackAttachment)
	for _, attachment := range attachments {
		newAttachment := *attachment
		for {
			lastSplit := splits[len(splits)-1]
			newProps := make(map[string]interface{})
			for k, v := range lastSplit.Props {
				newProps[k] = v
			}
			origAttachments, _ := newProps["attachments"].([]*model.SlackAttachment)
			newProps["attachments"] = append(origAttachments, &newAttachment)
			newPropsString := model.StringInterfaceToJson(newProps)
			runeCount := utf8.RuneCountInString(newPropsString)

			if runeCount <= model.POST_PROPS_MAX_USER_RUNES {
				lastSplit.Props = newProps
				break
			}

			if len(origAttachments) > 0 {
				newSplit := base
				splits = append(splits, &newSplit)
				continue
			}

			truncationNeeded := runeCount - model.POST_PROPS_MAX_USER_RUNES
			textRuneCount := utf8.RuneCountInString(attachment.Text)
			if textRuneCount < truncationNeeded {
				return nil, model.NewAppError("SplitWebhookPost", "web.incoming_webhook.split_props_length.app_error", map[string]interface{}{"Max": model.POST_PROPS_MAX_USER_RUNES}, "", http.StatusBadRequest)
			}
			x := 0
			for index := range attachment.Text {
				x++
				if x > textRuneCount-truncationNeeded {
					newAttachment.Text = newAttachment.Text[:index]
					break
				}
			}
			lastSplit.Props = newProps
			break
		}
	}

	return splits, nil
}

func (a *App) CreateWebhookPost(userId string, channel *model.Channel, text, overrideUsername, overrideIconUrl string, props model.StringInterface, postType string, postRootId string) (*model.Post, *model.AppError) {
	// parse links into Markdown format
	linkWithTextRegex := regexp.MustCompile(`<([^\n<\|>]+)\|([^\n>]+)>`)
	text = linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")

	post := &model.Post{UserId: userId, ChannelId: channel.Id, Message: text, Type: postType, RootId: postRootId}
	post.AddProp("from_webhook", "true")

	if strings.HasPrefix(post.Type, model.POST_SYSTEM_MESSAGE_PREFIX) {
		err := model.NewAppError("CreateWebhookPost", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.type"}, "", http.StatusBadRequest)
		return nil, err
	}

	if metrics := a.Metrics; metrics != nil {
		metrics.IncrementWebhookPost()
	}

	if a.Config().ServiceSettings.EnablePostUsernameOverride {
		if len(overrideUsername) != 0 {
			post.AddProp("override_username", overrideUsername)
		} else {
			post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
		}
	}

	if a.Config().ServiceSettings.EnablePostIconOverride {
		if len(overrideIconUrl) != 0 {
			post.AddProp("override_icon_url", overrideIconUrl)
		}
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if attachments, success := val.([]*model.SlackAttachment); success {
					model.ParseSlackAttachment(post, attachments)
				}
			} else if key != "override_icon_url" && key != "override_username" && key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	splits, err := SplitWebhookPost(post, a.MaxPostSize())
	if err != nil {
		return nil, err
	}

	for _, split := range splits {
		if _, err := a.CreatePostMissingChannel(split, false); err != nil {
			return nil, model.NewAppError("CreateWebhookPost", "api.post.create_webhook_post.creating.app_error", nil, "err="+err.Message, http.StatusInternalServerError)
		}
	}

	return splits[0], nil
}

func (a *App) CreateIncomingWebhookForChannel(creatorId string, channel *model.Channel, hook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("CreateIncomingWebhookForChannel", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hook.UserId = creatorId
	hook.TeamId = channel.TeamId

	if !a.Config().ServiceSettings.EnablePostUsernameOverride {
		hook.Username = ""
	}
	if !a.Config().ServiceSettings.EnablePostIconOverride {
		hook.IconURL = ""
	}

	if hook.Username != "" && !model.IsValidUsername(hook.Username) {
		return nil, model.NewAppError("CreateIncomingWebhookForChannel", "api.incoming_webhook.invalid_username.app_error", nil, "", http.StatusBadRequest)
	}

	if result := <-a.Srv.Store.Webhook().SaveIncoming(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func (a *App) UpdateIncomingWebhook(oldHook, updatedHook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("UpdateIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if !a.Config().ServiceSettings.EnablePostUsernameOverride {
		updatedHook.Username = oldHook.Username
	}
	if !a.Config().ServiceSettings.EnablePostIconOverride {
		updatedHook.IconURL = oldHook.IconURL
	}

	if updatedHook.Username != "" && !model.IsValidUsername(updatedHook.Username) {
		return nil, model.NewAppError("UpdateIncomingWebhook", "api.incoming_webhook.invalid_username.app_error", nil, "", http.StatusBadRequest)
	}

	updatedHook.Id = oldHook.Id
	updatedHook.UserId = oldHook.UserId
	updatedHook.CreateAt = oldHook.CreateAt
	updatedHook.UpdateAt = model.GetMillis()
	updatedHook.TeamId = oldHook.TeamId
	updatedHook.DeleteAt = oldHook.DeleteAt

	if result := <-a.Srv.Store.Webhook().UpdateIncoming(updatedHook); result.Err != nil {
		return nil, result.Err
	} else {
		a.InvalidateCacheForWebhook(oldHook.Id)
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func (a *App) DeleteIncomingWebhook(hookId string) *model.AppError {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return model.NewAppError("DeleteIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().DeleteIncoming(hookId, model.GetMillis()); result.Err != nil {
		return result.Err
	}

	a.InvalidateCacheForWebhook(hookId)

	return nil
}

func (a *App) GetIncomingWebhook(hookId string) (*model.IncomingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetIncoming(hookId, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func (a *App) GetIncomingWebhooksForTeamPage(teamId string, page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksForTeamPage", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetIncomingByTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.IncomingWebhook), nil
	}
}

func (a *App) GetIncomingWebhooksPage(page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksPage", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetIncomingList(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.IncomingWebhook), nil
	}
}

func (a *App) CreateOutgoingWebhook(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("CreateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(hook.ChannelId) != 0 {
		cchan := a.Srv.Store.Channel().Get(hook.ChannelId, true)

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

	if result := <-a.Srv.Store.Webhook().GetOutgoingByTeam(hook.TeamId, -1, -1); result.Err != nil {
		return nil, result.Err
	} else {
		allHooks := result.Data.([]*model.OutgoingWebhook)

		for _, existingOutHook := range allHooks {
			urlIntersect := utils.StringArrayIntersection(existingOutHook.CallbackURLs, hook.CallbackURLs)
			triggerIntersect := utils.StringArrayIntersection(existingOutHook.TriggerWords, hook.TriggerWords)

			if existingOutHook.ChannelId == hook.ChannelId && len(urlIntersect) != 0 && len(triggerIntersect) != 0 {
				return nil, model.NewAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.intersect.app_error", nil, "", http.StatusInternalServerError)
			}
		}
	}

	if result := <-a.Srv.Store.Webhook().SaveOutgoing(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func (a *App) UpdateOutgoingWebhook(oldHook, updatedHook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("UpdateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(updatedHook.ChannelId) > 0 {
		channel, err := a.GetChannel(updatedHook.ChannelId)
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
		return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.triggers.app_error", nil, "", http.StatusInternalServerError)
	}

	var result store.StoreResult
	if result = <-a.Srv.Store.Webhook().GetOutgoingByTeam(oldHook.TeamId, -1, -1); result.Err != nil {
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

	if result = <-a.Srv.Store.Webhook().UpdateOutgoing(updatedHook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func (a *App) GetOutgoingWebhook(hookId string) (*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetOutgoing(hookId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func (a *App) GetOutgoingWebhooksPage(page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetOutgoingList(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OutgoingWebhook), nil
	}
}

func (a *App) GetOutgoingWebhooksForChannelPage(channelId string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksForChannelPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetOutgoingByChannel(channelId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OutgoingWebhook), nil
	}
}

func (a *App) GetOutgoingWebhooksForTeamPage(teamId string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksForTeamPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().GetOutgoingByTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OutgoingWebhook), nil
	}
}

func (a *App) DeleteOutgoingWebhook(hookId string) *model.AppError {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return model.NewAppError("DeleteOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-a.Srv.Store.Webhook().DeleteOutgoing(hookId, model.GetMillis()); result.Err != nil {
		return result.Err
	}

	return nil
}

func (a *App) RegenOutgoingWebhookToken(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("RegenOutgoingWebhookToken", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hook.Token = model.NewId()

	if result := <-a.Srv.Store.Webhook().UpdateOutgoing(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OutgoingWebhook), nil
	}
}

func (a *App) HandleIncomingWebhook(hookId string, req *model.IncomingWebhookRequest) *model.AppError {
	if !a.Config().ServiceSettings.EnableIncomingWebhooks {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hchan := a.Srv.Store.Webhook().GetIncoming(hookId, true)

	if req == nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.parse.app_error", nil, "", http.StatusBadRequest)
	}

	text := req.Text
	if len(text) == 0 && req.Attachments == nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.text.app_error", nil, "", http.StatusBadRequest)
	}

	channelName := req.ChannelName
	webhookType := req.Type

	var hook *model.IncomingWebhook
	if result := <-hchan; result.Err != nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.invalid.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
	} else {
		hook = result.Data.(*model.IncomingWebhook)
	}

	uchan := a.Srv.Store.User().Get(hook.UserId)

	if len(req.Props) == 0 {
		req.Props = make(model.StringInterface)
	}

	req.Props["webhook_display_name"] = hook.DisplayName

	text = a.ProcessSlackText(text)
	req.Attachments = a.ProcessSlackAttachments(req.Attachments)
	// attachments is in here for slack compatibility
	if len(req.Attachments) > 0 {
		req.Props["attachments"] = req.Attachments
		webhookType = model.POST_SLACK_ATTACHMENT
	}

	var channel *model.Channel
	var cchan store.StoreChannel

	if len(channelName) != 0 {
		if channelName[0] == '@' {
			if result := <-a.Srv.Store.User().GetByUsername(channelName[1:]); result.Err != nil {
				return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.user.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
			} else {
				if ch, err := a.GetDirectChannel(hook.UserId, result.Data.(*model.User).Id); err != nil {
					return err
				} else {
					channel = ch
				}
			}
		} else if channelName[0] == '#' {
			cchan = a.Srv.Store.Channel().GetByName(hook.TeamId, channelName[1:], true)
		} else {
			cchan = a.Srv.Store.Channel().GetByName(hook.TeamId, channelName, true)
		}
	} else {
		cchan = a.Srv.Store.Channel().Get(hook.ChannelId, true)
	}

	if channel == nil {
		result := <-cchan
		if result.Err != nil {
			return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
		} else {
			channel = result.Data.(*model.Channel)
		}
	}

	if hook.ChannelLocked && hook.ChannelId != channel.Id {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.channel_locked.app_error", nil, "", http.StatusForbidden)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.user.app_error", nil, "err="+result.Err.Message, http.StatusForbidden)
	} else {
		user = result.Data.(*model.User)
	}

	if a.License() != nil && *a.Config().TeamSettings.ExperimentalTownSquareIsReadOnly &&
		channel.Name == model.DEFAULT_CHANNEL && !a.RolesGrantPermission(user.GetRoles(), model.PERMISSION_MANAGE_SYSTEM.Id) {
		return model.NewAppError("HandleIncomingWebhook", "api.post.create_post.town_square_read_only", nil, "", http.StatusForbidden)
	}

	if channel.Type != model.CHANNEL_OPEN && !a.HasPermissionToChannel(hook.UserId, channel.Id, model.PERMISSION_READ_CHANNEL) {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.permissions.app_error", nil, "", http.StatusForbidden)
	}

	overrideUsername := hook.Username
	if req.Username != "" {
		overrideUsername = req.Username
	}

	overrideIconUrl := hook.IconURL
	if req.IconURL != "" {
		overrideIconUrl = req.IconURL
	}

	_, err := a.CreateWebhookPost(hook.UserId, channel, text, overrideUsername, overrideIconUrl, req.Props, webhookType, "")
	return err
}

func (a *App) CreateCommandWebhook(commandId string, args *model.CommandArgs) (*model.CommandWebhook, *model.AppError) {
	hook := &model.CommandWebhook{
		CommandId: commandId,
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
		ParentId:  args.ParentId,
	}

	if result := <-a.Srv.Store.CommandWebhook().Save(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.CommandWebhook), nil
	}
}

func (a *App) HandleCommandWebhook(hookId string, response *model.CommandResponse) *model.AppError {
	if response == nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.parse.app_error", nil, "", http.StatusBadRequest)
	}

	var hook *model.CommandWebhook
	if result := <-a.Srv.Store.CommandWebhook().Get(hookId); result.Err != nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.invalid.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
	} else {
		hook = result.Data.(*model.CommandWebhook)
	}

	var cmd *model.Command
	if result := <-a.Srv.Store.Command().Get(hook.CommandId); result.Err != nil {
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

	if result := <-a.Srv.Store.CommandWebhook().TryUse(hook.Id, 5); result.Err != nil {
		return model.NewAppError("HandleCommandWebhook", "web.command_webhook.invalid.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
	}

	_, err := a.HandleCommandResponse(cmd, args, response, false)
	return err
}
