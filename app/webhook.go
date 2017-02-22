// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/tls"
	"io"
	"io/ioutil"
	"net/http"
	"regexp"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	TRIGGERWORDS_FULL       = 0
	TRIGGERWORDS_STARTSWITH = 1
)

func handleWebhookEvents(post *model.Post, team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return nil
	}

	if channel.Type != model.CHANNEL_OPEN {
		return nil
	}

	hchan := Srv.Store.Webhook().GetOutgoingByTeam(team.Id)
	result := <-hchan
	if result.Err != nil {
		return result.Err
	}

	hooks := result.Data.([]*model.OutgoingWebhook)
	if len(hooks) == 0 {
		return nil
	}

	splitWords := strings.Fields(post.Message)
	if len(splitWords) == 0 {
		return nil
	}
	firstWord := splitWords[0]

	relevantHooks := []*model.OutgoingWebhook{}
	for _, hook := range hooks {
		if hook.ChannelId == post.ChannelId || len(hook.ChannelId) == 0 {
			if hook.ChannelId == post.ChannelId && len(hook.TriggerWords) == 0 {
				relevantHooks = append(relevantHooks, hook)
			} else if hook.TriggerWhen == TRIGGERWORDS_FULL && hook.HasTriggerWord(firstWord) {
				relevantHooks = append(relevantHooks, hook)
			} else if hook.TriggerWhen == TRIGGERWORDS_STARTSWITH && hook.TriggerWordStartsWith(firstWord) {
				relevantHooks = append(relevantHooks, hook)
			}
		}
	}

	for _, hook := range relevantHooks {
		go func(hook *model.OutgoingWebhook) {
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
				TriggerWord: firstWord,
			}
			var body io.Reader
			var contentType string
			if hook.ContentType == "application/json" {
				body = strings.NewReader(payload.ToJSON())
				contentType = "application/json"
			} else {
				body = strings.NewReader(payload.ToFormValues())
				contentType = "application/x-www-form-urlencoded"
			}
			tr := &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
			}
			client := &http.Client{Transport: tr}

			for _, url := range hook.CallbackURLs {
				go func(url string) {
					req, _ := http.NewRequest("POST", url, body)
					req.Header.Set("Content-Type", contentType)
					req.Header.Set("Accept", "application/json")
					if resp, err := client.Do(req); err != nil {
						l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.event_post.error"), err.Error())
					} else {
						defer func() {
							ioutil.ReadAll(resp.Body)
							resp.Body.Close()
						}()
						respProps := model.MapFromJson(resp.Body)

						if text, ok := respProps["text"]; ok {
							if _, err := CreateWebhookPost(hook.CreatorId, hook.TeamId, post.ChannelId, text, respProps["username"], respProps["icon_url"], post.Props, post.Type); err != nil {
								l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.create_post.error"), err)
							}
						}
					}
				}(url)
			}

		}(hook)
	}

	return nil
}

func CreateWebhookPost(userId, teamId, channelId, text, overrideUsername, overrideIconUrl string, props model.StringInterface, postType string) (*model.Post, *model.AppError) {
	// parse links into Markdown format
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	text = linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")

	post := &model.Post{UserId: userId, ChannelId: channelId, Message: text, Type: postType}
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
			} else if key != "override_icon_url" && key != "override_username" && key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	if _, err := CreatePost(post, teamId, false); err != nil {
		return nil, model.NewLocAppError("CreateWebhookPost", "api.post.create_webhook_post.creating.app_error", nil, "err="+err.Message)
	}

	return post, nil
}

func CreateIncomingWebhookForChannel(userId string, channel *model.Channel, hook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("CreateIncomingWebhookForChannel", "api.webhook.create_incoming.disabled.app_errror", nil, "", http.StatusNotImplemented)
	}

	hook.UserId = userId
	hook.TeamId = channel.TeamId

	if result := <-Srv.Store.Webhook().SaveIncoming(hook); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.IncomingWebhook), nil
	}
}

func GetIncomingWebhooksForTeamPage(teamId string, page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksForTeamPage", "api.webhook.get_incoming.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetIncomingByTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.IncomingWebhook), nil
	}
}

func GetIncomingWebhooksPage(page, perPage int) ([]*model.IncomingWebhook, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		return nil, model.NewAppError("GetIncomingWebhooksPage", "api.webhook.get_incoming.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.Webhook().GetIncomingList(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.IncomingWebhook), nil
	}
}
