// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const (
	TriggerwordsExactMatch = 0
	TriggerwordsStartsWith = 1

	MaxIntegrationResponseSize = 1024 * 1024 // Posts can be <100KB at most, so this is likely more than enough
)

var linkWithTextRegex = regexp.MustCompile(`<([^\n<\|>]+)\|([^\|\n>]+)>`)

func (a *App) handleWebhookEvents(c request.CTX, post *model.Post, team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil
	}

	if channel.Type != model.ChannelTypeOpen {
		return nil
	}

	hooks, err := a.Srv().Store().Webhook().GetOutgoingByTeam(team.Id, -1, -1)
	if err != nil {
		return model.NewAppError("handleWebhookEvents", "app.webhooks.get_outgoing_by_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

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
		if hook.ChannelId == post.ChannelId || hook.ChannelId == "" {
			if hook.ChannelId == post.ChannelId && len(hook.TriggerWords) == 0 {
				relevantHooks = append(relevantHooks, hook)
				triggerWord = ""
			} else if hook.TriggerWhen == TriggerwordsExactMatch && hook.TriggerWordExactMatch(firstWord) {
				relevantHooks = append(relevantHooks, hook)
				triggerWord = hook.GetTriggerWord(firstWord, true)
			} else if hook.TriggerWhen == TriggerwordsStartsWith && hook.TriggerWordStartsWith(firstWord) {
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
		a.TriggerWebhook(c, payload, hook, post, channel)
	}

	return nil
}

func (a *App) TriggerWebhook(c request.CTX, payload *model.OutgoingWebhookPayload, hook *model.OutgoingWebhook, post *model.Post, channel *model.Channel) {
	logger := c.Logger().With(mlog.String("outgoing_webhook_id", hook.Id), mlog.String("post_id", post.Id), mlog.String("channel_id", channel.Id), mlog.String("content_type", hook.ContentType))

	var jsonBytes []byte
	var err error
	contentType := "application/x-www-form-urlencoded"
	if hook.ContentType == "application/json" {
		contentType = "application/json"
		jsonBytes, err = json.Marshal(payload)
		if err != nil {
			logger.Warn("Failed to encode to JSON", mlog.Err(err))
			return
		}
	}

	var wg sync.WaitGroup

	for i := range hook.CallbackURLs {
		var body io.Reader
		if hook.ContentType == "application/json" {
			body = bytes.NewReader(jsonBytes)
		} else {
			body = strings.NewReader(payload.ToFormValues())
		}
		wg.Add(1)

		// Get the callback URL by index to properly capture it for the go func
		url := hook.CallbackURLs[i]

		go func() {
			defer wg.Done()

			var accessToken *model.OutgoingOAuthConnectionToken

			// Retrieve an access token from a connection if one exists to use for the webhook request
			if a.Config().ServiceSettings.EnableOutgoingOAuthConnections != nil && *a.Config().ServiceSettings.EnableOutgoingOAuthConnections && a.OutgoingOAuthConnections() != nil {
				connection, err := a.OutgoingOAuthConnections().GetConnectionForAudience(c, url)
				if err != nil {
					logger.Error("Failed to find an outgoing oauth connection for the webhook", mlog.Err(err))
					return
				}

				if connection != nil {
					accessToken, err = a.OutgoingOAuthConnections().RetrieveTokenForConnection(c, connection)
					if err != nil {
						logger.Error("Failed to retrieve token for outgoing oauth connection", mlog.Err(err))
						return
					}
				}
			}

			webhookResp, err := a.doOutgoingWebhookRequest(url, body, contentType, accessToken)
			if err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					logger.Error("Outgoing Webhook POST timed out. Consider increasing ServiceSettings.OutgoingIntegrationRequestsTimeout.", mlog.Err(err))
				} else {
					logger.Error("Outgoing Webhook POST failed", mlog.Err(err))
				}
				return
			}

			if webhookResp != nil && (webhookResp.Text != nil || len(webhookResp.Attachments) > 0) {
				postRootId := ""
				if webhookResp.ResponseType == model.OutgoingHookResponseTypeComment {
					postRootId = post.Id
				}
				if len(webhookResp.Props) == 0 {
					webhookResp.Props = make(model.StringInterface)
				}
				webhookResp.Props[model.PostPropsWebhookDisplayName] = hook.DisplayName

				text := ""
				if webhookResp.Text != nil {
					text = a.ProcessSlackText(*webhookResp.Text)
				}
				webhookResp.Attachments = a.ProcessSlackAttachments(webhookResp.Attachments)
				// attachments is in here for slack compatibility
				if len(webhookResp.Attachments) > 0 {
					webhookResp.Props[model.PostPropsAttachments] = webhookResp.Attachments
				}
				if *a.Config().ServiceSettings.EnablePostUsernameOverride && hook.Username != "" && webhookResp.Username == "" {
					webhookResp.Username = hook.Username
				}

				if *a.Config().ServiceSettings.EnablePostIconOverride && hook.IconURL != "" && webhookResp.IconURL == "" {
					webhookResp.IconURL = hook.IconURL
				}
				if _, err := a.CreateWebhookPost(c, hook.CreatorId, channel, text, webhookResp.Username, webhookResp.IconURL, "", webhookResp.Props, webhookResp.Type, postRootId, webhookResp.Priority); err != nil {
					logger.Error("Failed to create response post.", mlog.Err(err))
				}
			}
		}()
	}
	wg.Wait()
}

func (a *App) doOutgoingWebhookRequest(url string, body io.Reader, contentType string, accessToken *model.OutgoingOAuthConnectionToken) (*model.OutgoingWebhookResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*a.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", "application/json")

	if accessToken != nil {
		req.Header.Add("Authorization", accessToken.AsHeaderValue())
	}

	resp, err := a.Srv().outgoingWebhookClient.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var hookResp model.OutgoingWebhookResponse
	if jsonErr := json.NewDecoder(io.LimitReader(resp.Body, MaxIntegrationResponseSize)).Decode(&hookResp); jsonErr != nil {
		if jsonErr == io.EOF {
			return nil, nil
		}
		return nil, model.NewAppError("doOutgoingWebhookRequest", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	return &hookResp, nil
}

func splitWebhookPost(post *model.Post, maxPostSize int) ([]*model.Post, *model.AppError) {
	splits := make([]*model.Post, 0)
	remainingText := post.Message

	base := post.Clone()
	base.Message = ""
	base.SetProps(make(map[string]any))
	for k, v := range post.GetProps() {
		if k != model.PostPropsAttachments {
			base.AddProp(k, v)
		}
	}

	if utf8.RuneCountInString(model.StringInterfaceToJSON(base.GetProps())) > model.PostPropsMaxUserRunes {
		return nil, model.NewAppError("splitWebhookPost", "web.incoming_webhook.split_props_length.app_error", map[string]any{"Max": model.PostPropsMaxUserRunes}, "", http.StatusBadRequest)
	}

	for utf8.RuneCountInString(remainingText) > maxPostSize {
		split := base.Clone()
		x := 0
		for index := range remainingText {
			x++
			if x > maxPostSize {
				split.Message = remainingText[:index]
				remainingText = remainingText[index:]
				break
			}
		}
		splits = append(splits, split)
	}

	split := base.Clone()
	split.Message = remainingText
	splits = append(splits, split)

	attachments, _ := post.GetProp(model.PostPropsAttachments).([]*model.SlackAttachment)
	for _, attachment := range attachments {
		newAttachment := *attachment
		for {
			lastSplit := splits[len(splits)-1]
			newProps := make(map[string]any)
			for k, v := range lastSplit.GetProps() {
				newProps[k] = v
			}
			origAttachments, _ := newProps[model.PostPropsAttachments].([]*model.SlackAttachment)
			newProps[model.PostPropsAttachments] = append(origAttachments, &newAttachment)
			newPropsString := model.StringInterfaceToJSON(newProps)
			runeCount := utf8.RuneCountInString(newPropsString)

			if runeCount <= model.PostPropsMaxUserRunes {
				lastSplit.SetProps(newProps)
				break
			}

			if len(origAttachments) > 0 {
				newSplit := base.Clone()
				splits = append(splits, newSplit)
				continue
			}

			truncationNeeded := runeCount - model.PostPropsMaxUserRunes
			textRuneCount := utf8.RuneCountInString(attachment.Text)
			if textRuneCount < truncationNeeded {
				return nil, model.NewAppError("splitWebhookPost", "web.incoming_webhook.split_props_length.app_error", map[string]any{"Max": model.PostPropsMaxUserRunes}, "", http.StatusBadRequest)
			}
			x := 0
			for index := range attachment.Text {
				x++
				if x > textRuneCount-truncationNeeded {
					newAttachment.Text = newAttachment.Text[:index]
					break
				}
			}
			lastSplit.SetProps(newProps)
			break
		}
	}

	return splits, nil
}

func (a *App) CreateWebhookPost(c request.CTX, userID string, channel *model.Channel, text, overrideUsername, overrideIconURL, overrideIconEmoji string, props model.StringInterface, postType string, postRootId string, priority *model.PostPriority) (*model.Post, *model.AppError) {
	// parse links into Markdown format
	text = linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")

	post := &model.Post{UserId: userID, ChannelId: channel.Id, Message: text, Type: postType, RootId: postRootId}
	post.AddProp(model.PostPropsFromWebhook, "true")

	if priority != nil {
		if priority.Priority == nil {
			err := model.NewAppError("CreateWebhookPost", "api.context.invalid_param.app_error", map[string]any{"Name": "webhook.priority.priority"}, "Setting the priority of a post is required to use priority.", http.StatusBadRequest)
			return nil, err
		}
		post.Metadata = &model.PostMetadata{
			Priority: priority,
		}
	}

	if strings.HasPrefix(post.Type, model.PostSystemMessagePrefix) {
		err := model.NewAppError("CreateWebhookPost", "api.context.invalid_param.app_error", map[string]any{"Name": "post.type"}, "", http.StatusBadRequest)
		return nil, err
	}

	if metrics := a.Metrics(); metrics != nil {
		metrics.IncrementWebhookPost()
	}

	if *a.Config().ServiceSettings.EnablePostUsernameOverride {
		if overrideUsername != "" {
			post.AddProp(model.PostPropsOverrideUsername, overrideUsername)
		} else {
			post.AddProp(model.PostPropsOverrideUsername, model.DefaultWebhookUsername)
		}
	}

	if *a.Config().ServiceSettings.EnablePostIconOverride {
		if overrideIconURL != "" {
			post.AddProp(model.PostPropsOverrideIconURL, overrideIconURL)
		}
		if overrideIconEmoji != "" {
			post.AddProp(model.PostPropsOverrideIconURL, overrideIconEmoji)
		}
	}

	if len(props) > 0 {
		for key, val := range props {
			switch key {
			case model.PostPropsAttachments:
				if attachments, success := val.([]*model.SlackAttachment); success {
					model.ParseSlackAttachment(post, attachments)
				}
			case model.PostPropsOverrideIconURL,
				model.PostPropsOverrideUsername,
				model.PostPropsFromWebhook:
			// Do nothing
			default:
				post.AddProp(key, val)
			}
		}
	}

	splits, err := splitWebhookPost(post, a.MaxPostSize())
	if err != nil {
		return nil, err
	}

	for _, split := range splits {
		if _, err = a.CreatePost(c, split, channel, model.CreatePostFlags{}); err != nil {
			return nil, model.NewAppError("CreateWebhookPost", "api.post.create_webhook_post.creating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return splits[0], nil
}

func (a *App) CreateIncomingWebhookForChannel(creatorId string, channel *model.Channel, hook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("CreateIncomingWebhookForChannel", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hook.UserId = creatorId
	hook.TeamId = channel.TeamId

	if !*a.Config().ServiceSettings.EnablePostUsernameOverride {
		hook.Username = ""
	}
	if !*a.Config().ServiceSettings.EnablePostIconOverride {
		hook.IconURL = ""
	}

	if hook.Username != "" && !model.IsValidUsername(hook.Username) {
		return nil, model.NewAppError("CreateIncomingWebhookForChannel", "api.incoming_webhook.invalid_username.app_error", nil, "", http.StatusBadRequest)
	}

	webhook, err := a.Srv().Store().Webhook().SaveIncoming(hook)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateIncomingWebhookForChannel", "app.webhooks.save_incoming.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateIncomingWebhookForChannel", "app.webhooks.save_incoming.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return webhook, nil
}

func (a *App) UpdateIncomingWebhook(oldHook, updatedHook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("UpdateIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if !*a.Config().ServiceSettings.EnablePostUsernameOverride {
		updatedHook.Username = oldHook.Username
	}
	if !*a.Config().ServiceSettings.EnablePostIconOverride {
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

	newWebhook, err := a.Srv().Store().Webhook().UpdateIncoming(updatedHook)
	if err != nil {
		return nil, model.NewAppError("UpdateIncomingWebhook", "app.webhooks.update_incoming.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	a.Srv().Platform().InvalidateCacheForWebhook(oldHook.Id)
	return newWebhook, nil
}

func (a *App) DeleteIncomingWebhook(hookID string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return model.NewAppError("DeleteIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := a.Srv().Store().Webhook().DeleteIncoming(hookID, model.GetMillis()); err != nil {
		return model.NewAppError("DeleteIncomingWebhook", "app.webhooks.delete_incoming.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.Srv().Platform().InvalidateCacheForWebhook(hookID)

	return nil
}

func (a *App) GetIncomingWebhook(hookID string) (*model.IncomingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhook", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhook, err := a.Srv().Store().Webhook().GetIncoming(hookID, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetIncomingWebhook", "app.webhooks.get_incoming.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetIncomingWebhook", "app.webhooks.get_incoming.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return webhook, nil
}

func (a *App) GetIncomingWebhooksForTeamPage(teamID string, page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	return a.GetIncomingWebhooksForTeamPageByUser(teamID, "", page, perPage)
}

func (a *App) GetIncomingWebhooksForTeamPageByUser(teamID string, userID string, page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksForTeamPage", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhooks, err := a.Srv().Store().Webhook().GetIncomingByTeamByUser(teamID, userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetIncomingWebhooksForTeamPage", "app.webhooks.get_incoming_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhooks, nil
}

func (a *App) GetIncomingWebhooksPageByUser(userID string, page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksPageByUser", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhooks, err := a.Srv().Store().Webhook().GetIncomingListByUser(userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetIncomingWebhooksPageByUser", "app.webhooks.get_incoming_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhooks, nil
}

func (a *App) GetIncomingWebhooksPage(page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	return a.GetIncomingWebhooksPageByUser("", page, perPage)
}

func (a *App) GetIncomingWebhooksCount(teamID string, userID string) (int64, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return 0, model.NewAppError("GetIncomingWebhooksCount", "api.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	totalCount, err := a.Srv().Store().Webhook().AnalyticsIncomingCount(teamID, userID)
	if err != nil {
		return 0, model.NewAppError("GetIncomingWebhooksCount", "app.webhooks.get_incoming_count.app_error", map[string]any{"TeamID": teamID, "UserID": userID, "Error": err.Error()}, "", http.StatusInternalServerError).Wrap(err)
	}

	return totalCount, nil
}

func (a *App) CreateOutgoingWebhook(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("CreateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if hook.ChannelId != "" {
		channel, errCh := a.Srv().Store().Channel().Get(hook.ChannelId, true)
		if errCh != nil {
			errCtx := map[string]any{"channel_id": hook.ChannelId}
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(errCh, &nfErr):
				return nil, model.NewAppError("CreateOutgoingWebhook", "app.channel.get.existing.app_error", errCtx, "", http.StatusNotFound).Wrap(errCh)
			default:
				return nil, model.NewAppError("CreateOutgoingWebhook", "app.channel.get.find.app_error", errCtx, "", http.StatusInternalServerError).Wrap(errCh)
			}
		}

		if channel.Type != model.ChannelTypeOpen {
			return nil, model.NewAppError("CreateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusForbidden)
		}

		if channel.Type != model.ChannelTypeOpen || channel.TeamId != hook.TeamId {
			return nil, model.NewAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.permissions.app_error", nil, "", http.StatusForbidden)
		}
	} else if len(hook.TriggerWords) == 0 {
		return nil, model.NewAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.triggers.app_error", nil, "", http.StatusBadRequest)
	}

	allHooks, err := a.Srv().Store().Webhook().GetOutgoingByTeam(hook.TeamId, -1, -1)
	if err != nil {
		return nil, model.NewAppError("CreateOutgoingWebhook", "app.webhooks.get_outgoing_by_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, existingOutHook := range allHooks {
		urlIntersect := utils.StringArrayIntersection(existingOutHook.CallbackURLs, hook.CallbackURLs)
		triggerIntersect := utils.StringArrayIntersection(existingOutHook.TriggerWords, hook.TriggerWords)

		if existingOutHook.ChannelId == hook.ChannelId && len(urlIntersect) != 0 && len(triggerIntersect) != 0 {
			return nil, model.NewAppError("CreateOutgoingWebhook", "api.webhook.create_outgoing.intersect.app_error", nil, "", http.StatusInternalServerError)
		}
	}

	webhook, err := a.Srv().Store().Webhook().SaveOutgoing(hook)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateOutgoingWebhook", "app.webhooks.save_outgoing.override.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateOutgoingWebhook", "app.webhooks.save_outgoing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return webhook, nil
}

func (a *App) UpdateOutgoingWebhook(c request.CTX, oldHook, updatedHook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("UpdateOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if updatedHook.ChannelId != "" {
		channel, err := a.GetChannel(c, updatedHook.ChannelId)
		if err != nil {
			return nil, err
		}

		if channel.Type != model.ChannelTypeOpen {
			return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.not_open.app_error", nil, "", http.StatusForbidden)
		}

		if channel.TeamId != oldHook.TeamId {
			return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.permissions.app_error", nil, "", http.StatusForbidden)
		}
	} else if len(updatedHook.TriggerWords) == 0 {
		return nil, model.NewAppError("UpdateOutgoingWebhook", "api.webhook.create_outgoing.triggers.app_error", nil, "", http.StatusInternalServerError)
	}

	allHooks, err := a.Srv().Store().Webhook().GetOutgoingByTeam(oldHook.TeamId, -1, -1)
	if err != nil {
		return nil, model.NewAppError("UpdateOutgoingWebhook", "app.webhooks.get_outgoing_by_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

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

	webhook, err := a.Srv().Store().Webhook().UpdateOutgoing(updatedHook)
	if err != nil {
		return nil, model.NewAppError("UpdateOutgoingWebhook", "app.webhooks.update_outgoing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhook, nil
}

func (a *App) GetOutgoingWebhook(hookID string) (*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhook, err := a.Srv().Store().Webhook().GetOutgoing(hookID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetOutgoingWebhook", "app.webhooks.get_outgoing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetOutgoingWebhook", "app.webhooks.get_outgoing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return webhook, nil
}

func (a *App) GetOutgoingWebhooksPage(page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	return a.GetOutgoingWebhooksPageByUser("", page, perPage)
}

func (a *App) GetOutgoingWebhooksPageByUser(userID string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksPageByUser", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhooks, err := a.Srv().Store().Webhook().GetOutgoingListByUser(userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOutgoingWebhooksPageByUser", "app.webhooks.get_outgoing_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhooks, nil
}

func (a *App) GetOutgoingWebhooksForChannelPageByUser(channelID string, userID string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksForChannelPage", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhooks, err := a.Srv().Store().Webhook().GetOutgoingByChannelByUser(channelID, userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOutgoingWebhooksForChannelPage", "app.webhooks.get_outgoing_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhooks, nil
}

func (a *App) GetOutgoingWebhooksForTeamPage(teamID string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	return a.GetOutgoingWebhooksForTeamPageByUser(teamID, "", page, perPage)
}

func (a *App) GetOutgoingWebhooksForTeamPageByUser(teamID string, userID string, page, perPage int) ([]*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("GetOutgoingWebhooksForTeamPageByUser", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	webhooks, err := a.Srv().Store().Webhook().GetOutgoingByTeamByUser(teamID, userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOutgoingWebhooksForTeamPageByUser", "app.webhooks.get_outgoing_by_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhooks, nil
}

func (a *App) DeleteOutgoingWebhook(hookID string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return model.NewAppError("DeleteOutgoingWebhook", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := a.Srv().Store().Webhook().DeleteOutgoing(hookID, model.GetMillis()); err != nil {
		return model.NewAppError("DeleteOutgoingWebhook", "app.webhooks.delete_outgoing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) RegenOutgoingWebhookToken(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOutgoingWebhooks {
		return nil, model.NewAppError("RegenOutgoingWebhookToken", "api.outgoing_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hook.Token = model.NewId()

	webhook, err := a.Srv().Store().Webhook().UpdateOutgoing(hook)
	if err != nil {
		return nil, model.NewAppError("RegenOutgoingWebhookToken", "app.webhooks.update_outgoing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return webhook, nil
}

func (a *App) HandleIncomingWebhook(c request.CTX, hookID string, req *model.IncomingWebhookRequest) *model.AppError {
	if !*a.Config().ServiceSettings.EnableIncomingWebhooks {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	hchan := make(chan store.StoreResult[*model.IncomingWebhook], 1)
	go func() {
		webhook, err := a.Srv().Store().Webhook().GetIncoming(hookID, true)
		hchan <- store.StoreResult[*model.IncomingWebhook]{Data: webhook, NErr: err}
		close(hchan)
	}()

	if req == nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.parse.app_error", nil, "", http.StatusBadRequest)
	}

	text := req.Text
	if text == "" && req.Attachments == nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.text.app_error", nil, "", http.StatusBadRequest)
	}

	channelName := req.ChannelName
	webhookType := req.Type

	var hook *model.IncomingWebhook
	result := <-hchan
	if result.NErr != nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.invalid.app_error", nil, "", http.StatusBadRequest).Wrap(result.NErr)
	}
	hook = result.Data

	uchan := make(chan store.StoreResult[*model.User], 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), hook.UserId)
		uchan <- store.StoreResult[*model.User]{Data: user, NErr: err}
		close(uchan)
	}()

	if len(req.Props) == 0 {
		req.Props = make(model.StringInterface)
	}

	req.Props[model.PostPropsWebhookDisplayName] = hook.DisplayName

	text = a.ProcessSlackText(text)
	req.Attachments = a.ProcessSlackAttachments(req.Attachments)
	// attachments is in here for slack compatibility
	if len(req.Attachments) > 0 {
		req.Props[model.PostPropsAttachments] = req.Attachments
		webhookType = model.PostTypeSlackAttachment
	}

	var channel *model.Channel
	var cchan chan store.StoreResult[*model.Channel]

	if channelName != "" {
		if channelName[0] == '@' {
			result, nErr := a.Srv().Store().User().GetByUsername(channelName[1:])
			if nErr != nil {
				return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.user.app_error", map[string]any{"user": channelName[1:]}, "", http.StatusBadRequest).Wrap(nErr)
			}
			ch, err := a.GetOrCreateDirectChannel(c, hook.UserId, result.Id)
			if err != nil {
				return err
			}
			channel = ch
		} else if channelName[0] == '#' {
			cchan = make(chan store.StoreResult[*model.Channel], 1)
			go func() {
				chnn, chnnErr := a.Srv().Store().Channel().GetByName(hook.TeamId, channelName[1:], true)
				cchan <- store.StoreResult[*model.Channel]{Data: chnn, NErr: chnnErr}
				close(cchan)
			}()
		} else {
			cchan = make(chan store.StoreResult[*model.Channel], 1)
			go func() {
				chnn, chnnErr := a.Srv().Store().Channel().GetByName(hook.TeamId, channelName, true)
				cchan <- store.StoreResult[*model.Channel]{Data: chnn, NErr: chnnErr}
				close(cchan)
			}()
		}
	} else {
		var err error
		channel, err = a.Srv().Store().Channel().Get(hook.ChannelId, true)
		if err != nil {
			errCtx := map[string]any{"channel_id": hook.ChannelId}
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return model.NewAppError("HandleIncomingWebhook", "app.channel.get.existing.app_error", errCtx, "", http.StatusNotFound).Wrap(err)
			default:
				return model.NewAppError("HandleIncomingWebhook", "app.channel.get.find.app_error", errCtx, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	if channel == nil {
		result2 := <-cchan
		if result2.NErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(result2.NErr, &nfErr):
				return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.channel.app_error", nil, "", http.StatusNotFound).Wrap(result2.NErr)
			default:
				return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.channel.app_error", nil, "", http.StatusInternalServerError).Wrap(result2.NErr)
			}
		}
		channel = result2.Data
	}

	if hook.ChannelLocked && hook.ChannelId != channel.Id {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.channel_locked.app_error", map[string]any{"channel_id": channel.Id}, "", http.StatusForbidden)
	}

	resultU := <-uchan
	if resultU.NErr != nil {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.user.app_error", map[string]any{"user": hook.UserId}, "", http.StatusForbidden).Wrap(resultU.NErr)
	}

	if channel.Type != model.ChannelTypeOpen && !a.HasPermissionToChannel(c, hook.UserId, channel.Id, model.PermissionReadChannelContent) {
		return model.NewAppError("HandleIncomingWebhook", "web.incoming_webhook.permissions.app_error", map[string]any{"user": hook.UserId, "channel": channel.Id}, "", http.StatusForbidden)
	}

	overrideUsername := hook.Username
	if req.Username != "" {
		overrideUsername = req.Username
	}

	overrideIconURL := hook.IconURL
	if req.IconURL != "" {
		overrideIconURL = req.IconURL
	}

	_, err := a.CreateWebhookPost(c, hook.UserId, channel, text, overrideUsername, overrideIconURL, req.IconEmoji, req.Props, webhookType, "", req.Priority)
	return err
}

func (a *App) CreateCommandWebhook(commandID string, args *model.CommandArgs) (*model.CommandWebhook, *model.AppError) {
	hook := &model.CommandWebhook{
		CommandId: commandID,
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
	}

	savedHook, err := a.Srv().Store().CommandWebhook().Save(hook)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateCommandWebhook", "app.command_webhook.create_command_webhook.existing", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateCommandWebhook", "app.command_webhook.create_command_webhook.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return savedHook, nil
}

func (a *App) HandleCommandWebhook(c request.CTX, hookID string, response *model.CommandResponse) *model.AppError {
	if response == nil {
		return model.NewAppError("HandleCommandWebhook", "app.command_webhook.handle_command_webhook.parse", nil, "", http.StatusBadRequest)
	}

	hook, nErr := a.Srv().Store().CommandWebhook().Get(hookID)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return model.NewAppError("HandleCommandWebhook", "app.command_webhook.get.missing", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return model.NewAppError("HandleCommandWebhook", "app.command_webhook.get.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	cmd, cmdErr := a.Srv().Store().Command().Get(hook.CommandId)
	if cmdErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(cmdErr, &appErr):
			return appErr
		default:
			return model.NewAppError("HandleCommandWebhook", "web.command_webhook.command.app_error", map[string]any{"command_id": hook.CommandId}, "", http.StatusBadRequest).Wrap(cmdErr)
		}
	}

	args := &model.CommandArgs{
		UserId:    hook.UserId,
		ChannelId: hook.ChannelId,
		TeamId:    cmd.TeamId,
		RootId:    hook.RootId,
	}

	if nErr := a.Srv().Store().CommandWebhook().TryUse(hook.Id, 5); nErr != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return model.NewAppError("HandleCommandWebhook", "app.command_webhook.try_use.invalid", nil, "", http.StatusBadRequest).Wrap(nErr)
		default:
			return model.NewAppError("HandleCommandWebhook", "app.command_webhook.try_use.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	_, err := a.HandleCommandResponse(c, cmd, args, response, false)
	return err
}
