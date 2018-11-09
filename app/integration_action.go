// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// Integration Action Flow
//
// 1. An integration creates an interactive message button or menu.
// 2. A user clicks on a button or selects an option from the menu.
// 3. The client sends a request to server to complete the post action, calling DoPostAction below.
// 4. DoPostAction will send an HTTP POST request to the integration containing contextual data, including
// an encoded and signed trigger ID. Slash commands also include trigger IDs in their payloads.
// 5. The integration performs any actions it needs to and optionally makes a request back to the MM server
// using the trigger ID to open an interactive dialog.
// 6. If that optional request is made, OpenInteractiveDialog sends a WebSocket event to all connected clients
// for the relevant user, telling them to display the dialog.
// 7. The user fills in the dialog and submits it, where SubmitInteractiveDialog will submit it back to the
// integration for handling.

package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/httpservice"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) DoPostAction(postId, actionId, userId, selectedOption string) (string, *model.AppError) {
	pchan := a.Srv.Store.Post().GetSingle(postId)
	cchan := a.Srv.Store.Channel().GetForPost(postId)

	result := <-pchan
	if result.Err != nil {
		return "", result.Err
	}
	post := result.Data.(*model.Post)

	result = <-cchan
	if result.Err != nil {
		return "", result.Err
	}
	channel := result.Data.(*model.Channel)

	action := post.GetAction(actionId)
	if action == nil || action.Integration == nil {
		return "", model.NewAppError("DoPostAction", "api.post.do_action.action_id.app_error", nil, fmt.Sprintf("action=%v", action), http.StatusNotFound)
	}

	request := &model.PostActionIntegrationRequest{
		UserId:    userId,
		ChannelId: post.ChannelId,
		TeamId:    channel.TeamId,
		PostId:    postId,
		Type:      action.Type,
		Context:   action.Integration.Context,
	}

	clientTriggerId, _, err := request.GenerateTriggerId(a.AsymmetricSigningKey())
	if err != nil {
		return "", err
	}

	if action.Type == model.POST_ACTION_TYPE_SELECT {
		request.DataSource = action.DataSource
		request.Context["selected_option"] = selectedOption
	}

	resp, err := a.DoActionRequest(action.Integration.URL, request.ToJson())
	if resp != nil {
		defer consumeAndClose(resp)
	}
	if err != nil {
		return "", err
	}

	var response model.PostActionIntegrationResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "", model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "err="+err.Error(), http.StatusBadRequest)
	}

	retainedProps := []string{"override_username", "override_icon_url"}

	if response.Update != nil {
		response.Update.Id = postId
		response.Update.AddProp("from_webhook", "true")
		for _, prop := range retainedProps {
			if value, ok := post.Props[prop]; ok {
				response.Update.Props[prop] = value
			} else {
				delete(response.Update.Props, prop)
			}
		}
		if _, err := a.UpdatePost(response.Update, false); err != nil {
			return "", err
		}
	}

	if response.EphemeralText != "" {
		ephemeralPost := &model.Post{}
		ephemeralPost.Message = model.ParseSlackLinksToMarkdown(response.EphemeralText)
		ephemeralPost.ChannelId = post.ChannelId
		ephemeralPost.RootId = post.RootId
		if ephemeralPost.RootId == "" {
			ephemeralPost.RootId = post.Id
		}
		ephemeralPost.UserId = post.UserId
		ephemeralPost.AddProp("from_webhook", "true")
		for _, prop := range retainedProps {
			if value, ok := post.Props[prop]; ok {
				ephemeralPost.Props[prop] = value
			} else {
				delete(ephemeralPost.Props, prop)
			}
		}
		a.SendEphemeralPost(userId, ephemeralPost)
	}

	return clientTriggerId, nil
}

// Perform an HTTP POST request to an integration's action endpoint.
// Caller must consume and close returned http.Response as necessary.
func (a *App) DoActionRequest(rawURL string, body []byte) (*http.Response, *model.AppError) {
	req, _ := http.NewRequest("POST", rawURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Allow access to plugin routes for action buttons
	var httpClient *httpservice.Client
	url, _ := url.Parse(rawURL)
	siteURL, _ := url.Parse(*a.Config().ServiceSettings.SiteURL)
	subpath, _ := utils.GetSubpathFromConfig(a.Config())
	if (url.Hostname() == "localhost" || url.Hostname() == "127.0.0.1" || url.Hostname() == siteURL.Hostname()) && strings.HasPrefix(url.Path, path.Join(subpath, "plugins")) {
		httpClient = a.HTTPService.MakeClient(true)
	} else {
		httpClient = a.HTTPService.MakeClient(false)
	}

	resp, httpErr := httpClient.Do(req)
	if httpErr != nil {
		return nil, model.NewAppError("DoActionRequest", "api.post.do_action.action_integration.app_error", nil, "err="+httpErr.Error(), http.StatusBadRequest)
	}

	if resp.StatusCode != http.StatusOK {
		return resp, model.NewAppError("DoActionRequest", "api.post.do_action.action_integration.app_error", nil, fmt.Sprintf("status=%v", resp.StatusCode), http.StatusBadRequest)
	}

	return resp, nil
}

func (a *App) OpenInteractiveDialog(request model.OpenDialogRequest) *model.AppError {
	clientTriggerId, userId, err := request.DecodeAndVerifyTriggerId(a.AsymmetricSigningKey())
	if err != nil {
		return err
	}

	request.TriggerId = clientTriggerId

	jsonRequest, _ := json.Marshal(request)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_OPEN_DIALOG, "", "", userId, nil)
	message.Add("dialog", string(jsonRequest))
	a.Publish(message)

	return nil
}

func (a *App) SubmitInteractiveDialog(request model.SubmitDialogRequest) *model.AppError {
	url := request.URL
	request.URL = ""
	request.Type = "dialog_submission"

	b, jsonErr := json.Marshal(request)
	if jsonErr != nil {
		return model.NewAppError("SubmitInteractiveDialog", "app.submit_interactive_dialog.json_error", nil, jsonErr.Error(), http.StatusBadRequest)
	}

	resp, err := a.DoActionRequest(url, b)
	if resp != nil {
		consumeAndClose(resp)
	}
	return err
}
